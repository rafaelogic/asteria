import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import os from "node:os";
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

const commands: Record<ProviderId, string> = { codex: "codex", claude: "claude" };
const requiredCapabilities: Record<ProviderId, string[]> = {
  codex: ["structured-stream", "cancellation", "isolated-home", "tool-events"],
  claude: ["structured-stream", "cancellation", "isolated-home", "tool-events"]
};

function versionNumber(value?: string) {
  const match = value?.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function detect(id: ProviderId): ProviderStatus {
  const result = spawnSync(commands[id], ["--version"], { encoding: "utf8", timeout: 4_000, shell: false });
  return {
    id,
    name: id === "codex" ? "OpenAI Codex" : "Claude Code",
    available: result.status === 0,
    version: result.status === 0 ? (result.stdout || result.stderr).trim() : undefined
  };
}

export class ProviderManager extends EventEmitter {
  private sessions = new Map<string, pty.IPty>();
  private normalizers = new Map<string, ProviderStreamNormalizer>();

  detectAll() {
    return [detect("codex"), detect("claude")].map((status) => ({
      ...status,
      capabilities: status.available ? requiredCapabilities[status.id] : [],
      authenticated: status.available
    }));
  }

  contracts(): ProviderContract[] {
    return this.detectAll().map((status) => {
      const parsed = versionNumber(status.version);
      const compatible = status.available && Boolean(parsed) && (status.id === "codex" ? parsed![0] >= 0 : parsed![0] >= 1);
      return {
        schemaVersion: 1,
        provider: status.id,
        minimumVersion: status.id === "codex" ? "0.100.0" : "1.0.0",
        detectedVersion: status.version,
        compatible,
        capabilities: status.capabilities ?? [],
        missingCapabilities: compatible ? [] : requiredCapabilities[status.id],
        remediation: compatible ? undefined : `Install a supported ${status.name} CLI and authenticate it inside Asteria.`
      };
    });
  }

  authenticate(provider: ProviderId, context: IsolationContext) {
    const contract = this.contracts().find((item) => item.provider === provider);
    if (!contract?.compatible) throw new Error(contract?.remediation ?? "Provider is unavailable.");
    const sessionId = context.sessionId;
    if (this.sessions.has(sessionId)) throw new Error("Authentication session is already running.");
    const args = provider === "codex" ? ["login", "--device-auth"] : ["auth", "login"];
    const process = pty.spawn(commands[provider], args, {
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
      this.emit("event", sessionId, {
        id: randomUUID(),
        type: exitCode === 0 ? "completed" : "error",
        timestamp: new Date().toISOString(),
        title: exitCode === 0 ? "Authentication complete" : "Authentication failed",
        detail: `${provider} login exited with code ${exitCode}`
      });
    });
    return { sessionId, pid: process.pid };
  }

  start(provider: ProviderId, prompt: string, context: IsolationContext) {
    const contract = this.contracts().find((item) => item.provider === provider);
    if (!contract?.compatible) throw new Error(contract?.remediation ?? "Provider is unavailable.");
    if (this.sessions.has(context.sessionId)) throw new Error("Session is already running.");
    const shell = os.platform() === "win32" ? "powershell.exe" : commands[provider];
    const args = os.platform() === "win32"
      ? ["-NoProfile", "-Command", `& ${commands[provider]} ${provider === "codex" ? "exec --json" : "-p --output-format stream-json"} -- $input`, prompt]
      : provider === "codex"
        ? ["exec", "--json", prompt]
        : ["-p", "--output-format", "stream-json", "--verbose", prompt];
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
    const parsed = JSON.parse(chunk);
    detail = parsed.message?.content ?? parsed.content ?? parsed.text ?? chunk.trim();
    type = parsed.type?.includes("tool") ? "tool_result" : parsed.type?.includes("reason") ? "reasoning" : "message";
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
