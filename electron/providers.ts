import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { accessSync, constants, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as pty from "node-pty";
import type { AgentEvent, AuthorizationPermission, ProviderContract, ProviderId, RiskClassification } from "../src/types.js";
import { redactSecrets } from "../src/redaction.js";
import type { IsolationContext } from "./isolation.js";

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  available: boolean;
  version?: string;
}

const requiredCapabilities: Record<ProviderId, string[]> = {
  codex: ["structured-stream", "cancellation", "isolated-home", "tool-events", "authorization-events", "session-resume"],
  claude: ["structured-stream", "cancellation", "isolated-home", "tool-events", "authorization-events", "session-resume"]
};

function executable(candidate: string) {
  try {
    accessSync(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function childDirectories(root: string) {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function resolveProviderCommand(
  id: ProviderId,
  options: { env?: NodeJS.ProcessEnv; home?: string } = {}
) {
  const env = options.env ?? process.env;
  const home = options.home ?? os.homedir();
  const binaryNames = process.platform === "win32" ? [`${id}.exe`, `${id}.cmd`, id] : [id];
  const candidates = (env.PATH ?? "").split(path.delimiter).filter(Boolean)
    .flatMap((directory) => binaryNames.map((name) => path.join(directory, name)));
  candidates.push(...binaryNames.flatMap((name) => [
    path.join(home, ".local", "bin", name),
    path.join(home, "bin", name),
    path.join("/usr/local/bin", name),
    path.join("/usr/bin", name),
    path.join("/snap/bin", name)
  ]));

  for (const version of childDirectories(path.join(home, ".nvm", "versions", "node"))) {
    candidates.push(...binaryNames.map((name) => path.join(home, ".nvm", "versions", "node", version, "bin", name)));
  }

  const extensionRoots = [path.join(home, ".vscode", "extensions"), path.join(home, ".vscode-insiders", "extensions")];
  const extensionPrefixes = id === "codex" ? ["openai.chatgpt-"] : ["anthropic.claude-"];
  for (const extensionRoot of extensionRoots) {
    for (const extension of childDirectories(extensionRoot).filter((name) => extensionPrefixes.some((prefix) => name.startsWith(prefix)))) {
      const binRoot = path.join(extensionRoot, extension, "bin");
      for (const platformDirectory of childDirectories(binRoot)) {
        candidates.push(...binaryNames.map((name) => path.join(binRoot, platformDirectory, name)));
      }
    }
  }

  return candidates.find(executable);
}

export function providerStartArgs(
  provider: ProviderId,
  prompt: string,
  options: { workspaceWrite?: boolean; model?: string } = {}
) {
  if (provider === "codex") {
    return [
      "exec",
      "--json",
      "--sandbox",
      options.workspaceWrite ? "workspace-write" : "read-only",
      "-c",
      'approval_policy="on-request"',
      ...(options.model && options.model !== "provider-configured-default" ? ["--model", options.model] : []),
      prompt,
    ];
  }
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    options.workspaceWrite ? "default" : "plan",
    ...(options.model && options.model !== "provider-configured-default" ? ["--model", options.model] : []),
    prompt,
  ];
}

export function providerExecutionPath(command: string, currentPath = "", ownerHome = os.homedir()) {
  const ownerToolDirectories = [
    path.join(ownerHome, ".local", "bin"),
    path.join(ownerHome, "bin"),
    ...childDirectories(path.join(ownerHome, ".nvm", "versions", "node"))
      .flatMap((version) => path.join(ownerHome, ".nvm", "versions", "node", version, "bin")),
    "/home/linuxbrew/.linuxbrew/bin",
    "/home/linuxbrew/.linuxbrew/sbin",
  ];
  return [...new Set([
    path.dirname(command),
    ...ownerToolDirectories,
    ...currentPath.split(path.delimiter).filter(Boolean),
  ])].join(path.delimiter);
}

function versionNumber(value?: string) {
  const match = value?.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function atLeast(actual: number[] | undefined, minimum: [number, number, number]) {
  if (!actual) return false;
  return actual[0] > minimum[0]
    || actual[0] === minimum[0] && (actual[1] > minimum[1]
      || actual[1] === minimum[1] && actual[2] >= minimum[2]);
}

function detect(id: ProviderId): ProviderStatus {
  const command = resolveProviderCommand(id);
  const result = command
    ? spawnSync(command, ["--version"], { encoding: "utf8", timeout: 4_000, shell: false })
    : undefined;
  return {
    id,
    name: id === "codex" ? "OpenAI Codex" : "Claude Code",
    available: result?.status === 0,
    version: result?.status === 0 ? (result.stdout || result.stderr).trim() : undefined
  };
}

export class ProviderManager extends EventEmitter {
  private sessions = new Map<string, pty.IPty>();
  private sessionProviders = new Map<string, ProviderId>();
  private approvalRequestIds = new Map<string, string | number>();
  private completedAppServerSessions = new Set<string>();
  private normalizers = new Map<string, ProviderStreamNormalizer>();

  detectAll() {
    return [detect("codex"), detect("claude")].map((status) => ({
      ...status,
      capabilities: status.available ? requiredCapabilities[status.id] : [],
      authenticated: false
    }));
  }

  isAuthenticated(provider: ProviderId, context: IsolationContext) {
    const command = resolveProviderCommand(provider);
    if (!command) return false;
    const args = provider === "codex" ? ["login", "status"] : ["auth", "status"];
    const result = spawnSync(command, args, {
      encoding: "utf8",
      timeout: 8_000,
      shell: false,
      env: context.env
    });
    return result.status === 0;
  }

  contracts(): ProviderContract[] {
    return this.detectAll().map((status) => {
      const parsed = versionNumber(status.version);
      const minimum: [number, number, number] = status.id === "codex" ? [0, 146, 0] : [1, 0, 0];
      const compatible = status.available && atLeast(parsed, minimum);
      const remediation = !status.available
        ? `${status.name} CLI was not found in PATH, a local/NVM installation, or its supported VS Code extension.`
        : !parsed
          ? `${status.name} returned an unreadable version string.`
          : compatible ? undefined : `Upgrade ${status.name} to a supported version.`;
      return {
        schemaVersion: 1,
        provider: status.id,
        minimumVersion: status.id === "codex" ? "0.146.0" : "1.0.0",
        detectedVersion: status.version,
        compatible,
        capabilities: status.capabilities ?? [],
        missingCapabilities: compatible ? [] : requiredCapabilities[status.id],
        remediation
      };
    });
  }

  authenticate(provider: ProviderId, context: IsolationContext) {
    const contract = this.contracts().find((item) => item.provider === provider);
    if (!contract?.compatible) throw new Error(contract?.remediation ?? "Provider is unavailable.");
    const sessionId = context.sessionId;
    if (this.sessions.has(sessionId)) throw new Error("Authentication session is already running.");
    const args = provider === "codex" ? ["login", "--device-auth"] : ["auth", "login"];
    const command = resolveProviderCommand(provider);
    if (!command) throw new Error(`${provider === "codex" ? "OpenAI Codex" : "Claude Code"} CLI could not be resolved.`);
    const process = pty.spawn(command, args, {
      name: "xterm-256color",
      cols: 100,
      rows: 30,
      cwd: context.appHome,
      env: context.env as Record<string, string>
    });
    this.sessions.set(sessionId, process);
    const normalizer = new ProviderStreamNormalizer();
    this.normalizers.set(sessionId, normalizer);
    process.onData((chunk) => normalizer.push(chunk).forEach((event) => this.emit("event", sessionId, event)));
    process.onExit(({ exitCode }) => {
      normalizer.flush().forEach((event) => this.emit("event", sessionId, event));
      this.sessions.delete(sessionId);
      this.normalizers.delete(sessionId);
      const authenticated = exitCode === 0 && this.isAuthenticated(provider, context);
      this.emit("event", sessionId, {
        id: randomUUID(),
        type: authenticated ? "completed" : "error",
        timestamp: new Date().toISOString(),
        title: authenticated ? "Authentication complete" : "Authentication failed",
        detail: authenticated ? `${provider} authentication was verified in Asteria's isolated profile.` : `${provider} login ended without a verified isolated profile.`
      });
    });
    return { sessionId, pid: process.pid };
  }

  start(provider: ProviderId, prompt: string, context: IsolationContext, options: { workspaceWrite?: boolean; model?: string } = {}) {
    if (this.sessions.has(context.sessionId)) throw new Error("Session is already running.");
    const command = resolveProviderCommand(provider);
    if (!command) throw new Error(`${provider === "codex" ? "OpenAI Codex" : "Claude Code"} CLI could not be resolved.`);
    if (provider === "codex" && os.platform() !== "win32") return this.startCodexAppServer(command, prompt, context, options);
    const shell = os.platform() === "win32" ? "powershell.exe" : command;
    const providerArgs = providerStartArgs(provider, prompt, options);
    const modelFlag = options.model && options.model !== "provider-configured-default" ? ` --model '${options.model.replaceAll("'", "''")}'` : "";
    const windowsFlags = provider === "codex"
      ? `exec --json --sandbox ${options.workspaceWrite ? "workspace-write" : "read-only"} -c 'approval_policy="on-request"'${modelFlag}`
      : `-p --output-format stream-json --verbose --permission-mode ${options.workspaceWrite ? "default" : "plan"}${modelFlag}`;
    const args = os.platform() === "win32"
      ? ["-NoProfile", "-Command", `& '${command.replaceAll("'", "''")}' ${windowsFlags} -- $input`, prompt]
      : providerArgs;
    const env = {
      ...context.env,
      PATH: providerExecutionPath(command, context.env.PATH),
    };
    const process = pty.spawn(shell, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 36,
      cwd: context.workspaceRoot,
      env: env as Record<string, string>
    });
    this.sessions.set(context.sessionId, process);
    this.sessionProviders.set(context.sessionId, provider);
    const normalizer = new ProviderStreamNormalizer();
    this.normalizers.set(context.sessionId, normalizer);
    process.onData((chunk) => normalizer.push(chunk).forEach((event) => this.emit("event", context.sessionId, event)));
    process.onExit(({ exitCode }) => {
      normalizer.flush().forEach((event) => this.emit("event", context.sessionId, event));
      this.sessions.delete(context.sessionId);
      this.sessionProviders.delete(context.sessionId);
      this.normalizers.delete(context.sessionId);
      this.emit("event", context.sessionId, {
        id: randomUUID(),
        type: exitCode === 0 ? "completed" : "error",
        timestamp: new Date().toISOString(),
        title: exitCode === 0 ? "Run completed" : "Provider exited",
        detail: `Exit code ${exitCode}`
      });
    });
    return { pid: process.pid };
  }

  private startCodexAppServer(command: string, prompt: string, context: IsolationContext, options: { workspaceWrite?: boolean; model?: string }) {
    const process = pty.spawn(command, ["app-server", "--stdio"], {
      name: "xterm-256color",
      cols: 120,
      rows: 36,
      cwd: context.workspaceRoot,
      env: { ...context.env, PATH: providerExecutionPath(command, context.env.PATH) } as Record<string, string>,
    });
    const sessionId = context.sessionId;
    this.sessions.set(sessionId, process);
    this.sessionProviders.set(sessionId, "codex");
    let buffer = "";
    let ended = false;
    const send = (value: unknown) => {
      if (ended || !this.sessions.has(sessionId)) return false;
      try { process.write(`${JSON.stringify(value)}\n`); return true; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EPIPE") throw error;
        ended = true;
        return false;
      }
    };
    send({ id: 1, method: "initialize", params: { clientInfo: { name: "asteria", title: "Asteria", version: "0.15.0" }, capabilities: { experimentalApi: true, requestAttestation: false } } });
    process.onData((chunk) => {
      buffer += chunk.replace(/\r\n/g, "\n");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const rawLine of lines.map((line) => line.trim()).filter(Boolean)) {
        try {
          const message = JSON.parse(rawLine) as Record<string, any>;
          if (message.id === 1 && message.result) {
            send({ method: "initialized" });
            send({ id: 2, method: "thread/start", params: {
              cwd: context.workspaceRoot,
              approvalPolicy: "on-request",
              approvalsReviewer: "user",
              sandbox: options.workspaceWrite ? "workspace-write" : "read-only",
              model: options.model && options.model !== "provider-configured-default" ? options.model : null,
              ephemeral: false,
            } });
            continue;
          }
          if (message.id === 2 && message.result?.thread?.id) {
            send({ id: 3, method: "turn/start", params: {
              threadId: message.result.thread.id,
              input: [{ type: "text", text: prompt, text_elements: [] }],
              approvalPolicy: "on-request",
              approvalsReviewer: "user",
            } });
            continue;
          }
          if (typeof message.method === "string" && /requestApproval$/.test(message.method) && message.id !== undefined) {
            this.approvalRequestIds.set(sessionId, message.id);
          }
          if (message.method === "turn/completed") {
            this.completedAppServerSessions.add(sessionId);
            this.emit("event", sessionId, { id: randomUUID(), type: "completed", timestamp: new Date().toISOString(), title: "Run completed", detail: "Codex app-server turn completed." });
            ended = true;
            process.kill();
            continue;
          }
        } catch {
          // Non-protocol stderr is normalized into a redacted local event below.
        }
        this.emit("event", sessionId, normalizeEvent(rawLine));
      }
    });
    process.onExit(({ exitCode }) => {
      ended = true;
      this.sessions.delete(sessionId);
      this.sessionProviders.delete(sessionId);
      this.approvalRequestIds.delete(sessionId);
      if (this.completedAppServerSessions.delete(sessionId)) return;
      this.emit("event", sessionId, { id: randomUUID(), type: "error", timestamp: new Date().toISOString(), title: "Provider exited", detail: `Codex app-server exit code ${exitCode}` });
    });
    return { pid: process.pid };
  }

  cancel(sessionId: string) {
    this.sessions.get(sessionId)?.kill();
    this.sessions.delete(sessionId);
    this.normalizers.delete(sessionId);
    this.sessionProviders.delete(sessionId);
  }

  respondAuthorization(sessionId: string, decision: "allow" | "deny") {
    const process = this.sessions.get(sessionId);
    if (!process) return false;
    if (this.sessionProviders.get(sessionId) === "codex") {
      const id = this.approvalRequestIds.get(sessionId);
      if (id === undefined) return false;
      process.write(`${JSON.stringify({ id, result: { decision: decision === "allow" ? "accept" : "decline" } })}\n`);
      this.approvalRequestIds.delete(sessionId);
      return true;
    }
    process.write(decision === "allow" ? "y\r" : "n\r");
    return true;
  }
}

export function normalizeEvent(chunk: string) {
  let detail = chunk.trim();
  let type = "message";
  let authorization: AgentEvent["authorization"];
  try {
    const parsed = JSON.parse(chunk) as Record<string, any>;
    const contentText = (value: unknown): string | undefined => {
      if (typeof value === "string") return value;
      if (!Array.isArray(value)) return undefined;
      const text = value
        .map((item) => typeof item === "string" ? item : item && typeof item === "object"
          ? (item as Record<string, unknown>).text ?? (item as Record<string, unknown>).content
          : undefined)
        .filter((item): item is string => typeof item === "string")
        .join("");
      return text || undefined;
    };
    const eventName = typeof parsed.type === "string" ? parsed.type : typeof parsed.method === "string" ? parsed.method : "provider_event";
    const item = parsed.item && typeof parsed.item === "object" ? parsed.item as Record<string, unknown>
      : parsed.params && typeof parsed.params === "object" ? parsed.params as Record<string, unknown> : undefined;
    const itemType = typeof item?.type === "string" ? item.type : "";
    const serialized = JSON.stringify(parsed);
    const approvalLike = /approval|required_permission|permission_request|request_permission/i.test(`${eventName} ${itemType}`);
    const authenticationLike = Number(parsed.status ?? parsed.status_code) === 401
      || (/(?:error|auth)/i.test(`${eventName} ${itemType}`)
        && /unauthorized|authentication required|not logged in|invalid.*token|status.?[:=]?401/i.test(serialized));
    if (approvalLike || authenticationLike) {
      const rawCommand = item?.command ?? parsed.command ?? parsed.operation ?? (itemType || eventName);
      const command = Array.isArray(rawCommand) ? rawCommand.join(" ") : String(rawCommand);
      const resource = String(parsed.cwd ?? item?.cwd ?? parsed.resource ?? command);
      const permission: AuthorizationPermission = /network|url|domain/i.test(serialized) ? "network"
        : /write|edit|patch/i.test(serialized) ? "filesystem_write"
        : /git/i.test(command) ? "git_write"
        : /deploy|production/i.test(serialized) ? "deployment"
        : "command_execute";
      const risk: RiskClassification = /delete|drop|truncate|production|destroy/i.test(serialized) ? "destructive"
        : permission === "filesystem_write" || permission === "git_write" ? "workspace_write"
        : permission === "network" || permission === "deployment" ? "external_mutation"
        : "read";
      authorization = {
        kind: authenticationLike ? "authentication" : "permission",
        permission: authenticationLike ? "credential" : permission,
        operation: authenticationLike ? "provider.authenticate" : command,
        resource,
        reason: authenticationLike ? "The provider session requires authentication." : "The provider requested additional authority.",
        risk,
        providerRequestId: parsed.id === undefined ? undefined : String(parsed.id),
      };
      type = "approval_required";
      detail = authorization.reason;
    }
    const message = parsed.message && typeof parsed.message === "object" ? parsed.message as Record<string, unknown> : undefined;
    const visibleText =
      (itemType === "agent_message" ? contentText(item?.text) : undefined)
      ?? contentText(message?.content)
      ?? contentText((parsed.params as Record<string, unknown> | undefined)?.delta)
      ?? contentText(parsed.delta?.text)
      ?? contentText(parsed.content)
      ?? contentText(parsed.text)
      ?? contentText(parsed.result);
    if (!authorization && visibleText) {
      detail = visibleText;
      type = itemType === "agent_message" || eventName === "assistant" || eventName.includes("message") || eventName.includes("delta") || eventName === "result"
        ? "message"
        : eventName.includes("tool") || itemType.includes("command") ? "tool_result" : "reasoning";
    } else if (!authorization) {
      detail = eventName.replaceAll("_", " ");
      type = eventName.includes("tool") || itemType.includes("command") ? "tool_result" : "reasoning";
    }
  } catch {
    // Some provider progress is plain text; preserve it as a local event.
  }
  return {
    id: randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    title: type === "approval_required" ? "Authorization required" : type === "tool_result" ? "Tool update" : "Agent update",
    detail: redactSecrets(detail),
    authorization,
  };
}

export class ProviderStreamNormalizer {
  private buffer = "";

  push(chunk: string) {
    this.buffer += chunk.replace(/\r\n/g, "\n");
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    return lines.map((line) => line.trim()).filter(Boolean).map(normalizeEvent);
  }

  flush() {
    const value = this.buffer.trim();
    this.buffer = "";
    return value ? [normalizeEvent(value)] : [];
  }
}
