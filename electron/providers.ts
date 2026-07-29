import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { accessSync, constants, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as pty from "node-pty";
import type { ProviderContract, ProviderId } from "../src/types.js";
import { redactSecrets } from "../src/redaction.js";
import type { IsolationContext } from "./isolation.js";

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  available: boolean;
  version?: string;
}

const requiredCapabilities: Record<ProviderId, string[]> = {
  codex: ["structured-stream", "cancellation", "isolated-home", "tool-events"],
  claude: ["structured-stream", "cancellation", "isolated-home", "tool-events"]
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
  options: { workspaceWrite?: boolean } = {}
) {
  if (provider === "codex") {
    return [
      "exec",
      "--json",
      "--sandbox",
      options.workspaceWrite ? "workspace-write" : "read-only",
      prompt,
    ];
  }
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    options.workspaceWrite ? "acceptEdits" : "plan",
    prompt,
  ];
}

function versionNumber(value?: string) {
  const match = value?.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
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
      const compatible = status.available && Boolean(parsed) && (status.id === "codex" ? parsed![0] >= 0 : parsed![0] >= 1);
      const remediation = !status.available
        ? `${status.name} CLI was not found in PATH, a local/NVM installation, or its supported VS Code extension.`
        : !parsed
          ? `${status.name} returned an unreadable version string.`
          : compatible ? undefined : `Upgrade ${status.name} to a supported version.`;
      return {
        schemaVersion: 1,
        provider: status.id,
        minimumVersion: status.id === "codex" ? "0.100.0" : "1.0.0",
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

  start(provider: ProviderId, prompt: string, context: IsolationContext, options: { workspaceWrite?: boolean } = {}) {
    if (this.sessions.has(context.sessionId)) throw new Error("Session is already running.");
    const command = resolveProviderCommand(provider);
    if (!command) throw new Error(`${provider === "codex" ? "OpenAI Codex" : "Claude Code"} CLI could not be resolved.`);
    if (!this.isAuthenticated(provider, context)) {
      throw new Error(`${provider === "codex" ? "OpenAI Codex" : "Claude Code"} is installed, but Asteria's isolated provider profile is not authenticated. Sign in from Asteria Settings.`);
    }
    const shell = os.platform() === "win32" ? "powershell.exe" : command;
    const providerArgs = providerStartArgs(provider, prompt, options);
    const windowsFlags = provider === "codex"
      ? `exec --json --sandbox ${options.workspaceWrite ? "workspace-write" : "read-only"}`
      : `-p --output-format stream-json --verbose --permission-mode ${options.workspaceWrite ? "acceptEdits" : "plan"}`;
    const args = os.platform() === "win32"
      ? ["-NoProfile", "-Command", `& '${command.replaceAll("'", "''")}' ${windowsFlags} -- $input`, prompt]
      : providerArgs;
    const process = pty.spawn(shell, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 36,
      cwd: context.workspaceRoot,
      env: context.env as Record<string, string>
    });
    this.sessions.set(context.sessionId, process);
    const normalizer = new ProviderStreamNormalizer();
    this.normalizers.set(context.sessionId, normalizer);
    process.onData((chunk) => normalizer.push(chunk).forEach((event) => this.emit("event", context.sessionId, event)));
    process.onExit(({ exitCode }) => {
      normalizer.flush().forEach((event) => this.emit("event", context.sessionId, event));
      this.sessions.delete(context.sessionId);
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

  cancel(sessionId: string) {
    this.sessions.get(sessionId)?.kill();
    this.sessions.delete(sessionId);
    this.normalizers.delete(sessionId);
  }
}

export function normalizeEvent(chunk: string) {
  let detail = chunk.trim();
  let type = "message";
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
    const eventName = typeof parsed.type === "string" ? parsed.type : "provider_event";
    const item = parsed.item && typeof parsed.item === "object" ? parsed.item as Record<string, unknown> : undefined;
    const itemType = typeof item?.type === "string" ? item.type : "";
    const message = parsed.message && typeof parsed.message === "object" ? parsed.message as Record<string, unknown> : undefined;
    const visibleText =
      (itemType === "agent_message" ? contentText(item?.text) : undefined)
      ?? contentText(message?.content)
      ?? contentText(parsed.delta?.text)
      ?? contentText(parsed.content)
      ?? contentText(parsed.text)
      ?? contentText(parsed.result);
    if (visibleText) {
      detail = visibleText;
      type = itemType === "agent_message" || eventName === "assistant" || eventName.includes("message") || eventName.includes("delta") || eventName === "result"
        ? "message"
        : eventName.includes("tool") || itemType.includes("command") ? "tool_result" : "reasoning";
    } else {
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
    title: type === "tool_result" ? "Tool update" : "Agent update",
    detail: redactSecrets(detail)
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
