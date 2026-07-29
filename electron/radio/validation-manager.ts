import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type HostValidationId = "unit" | "typecheck" | "build" | "sites" | "release";

export interface HostValidationCheck {
  id: HostValidationId;
  label: string;
  command: string;
  args: string[];
  passed: boolean;
  exitCode: number | null;
  durationMs: number;
  output: string;
}

export interface HostValidationEvidence {
  repository: string;
  checks: HostValidationCheck[];
  passed: boolean;
  digest: string;
  verifiedAt: string;
}

const ALLOWED_CHECKS: Record<HostValidationId, { label: string; command: string; args: string[]; timeoutMs: number }> = {
  unit: { label: "Unit tests", command: "npm", args: ["test", "--", "--run"], timeoutMs: 180_000 },
  typecheck: { label: "Type checking", command: "npm", args: ["run", "typecheck"], timeoutMs: 120_000 },
  build: { label: "Production and Electron build", command: "npm", args: ["run", "build"], timeoutMs: 240_000 },
  sites: { label: "Sites worker", command: "npm", args: ["run", "test:sites"], timeoutMs: 120_000 },
  release: { label: "Release acceptance", command: "npm", args: ["run", "test:release"], timeoutMs: 120_000 }
};

const SOURCE_CHANGE_CHECKS: HostValidationId[] = ["unit", "typecheck", "build", "sites", "release"];

function cleanOutput(value: string) {
  return value
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/(?:ghp|github_pat|sk|xox[baprs])_[A-Za-z0-9_-]+/g, "<redacted>")
    .slice(-8_000)
    .trim();
}

export function validationChecksForMaintenance(hasSource: boolean, body: string): HostValidationId[] {
  if (!hasSource) return [];
  if (/\b(implement|edit|change|modify|fix|repair|build|test|package|release|reinstall|commit)\b/i.test(body)) {
    return [...SOURCE_CHANGE_CHECKS];
  }
  return [];
}

async function runAllowedCheck(repositoryPath: string, id: HostValidationId): Promise<HostValidationCheck> {
  const allowed = ALLOWED_CHECKS[id];
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(allowed.command, allowed.args, {
      cwd: repositoryPath,
      env: { ...process.env, CI: "1", NO_COLOR: "1", BROWSER: "none" },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    const remember = (chunk: Buffer) => {
      output = `${output}${chunk.toString("utf8")}`.slice(-16_000);
    };
    child.stdout?.on("data", remember);
    child.stderr?.on("data", remember);
    const timer = setTimeout(() => child.kill("SIGTERM"), allowed.timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ id, label: allowed.label, command: allowed.command, args: [...allowed.args], passed: false, exitCode: null, durationMs: Date.now() - startedAt, output: cleanOutput(error.message) });
    });
    child.once("exit", (exitCode, signal) => {
      clearTimeout(timer);
      const timedOut = signal === "SIGTERM";
      resolve({
        id,
        label: allowed.label,
        command: allowed.command,
        args: [...allowed.args],
        passed: exitCode === 0,
        exitCode,
        durationMs: Date.now() - startedAt,
        output: cleanOutput(`${output}${timedOut ? `\nTimed out after ${allowed.timeoutMs} ms.` : ""}`)
      });
    });
  });
}

export class HostValidationManager {
  async run(repositoryPath: string, ids: HostValidationId[]): Promise<HostValidationEvidence> {
    const manifest = JSON.parse(await readFile(path.join(repositoryPath, "package.json"), "utf8")) as {
      name?: string;
      scripts?: Record<string, string>;
    };
    if (manifest.name !== "asteria") throw new Error("Host validation requires the validated Asteria source repository.");
    for (const id of ids) {
      if (!ALLOWED_CHECKS[id]) throw new Error(`Host validation check is not allowlisted: ${String(id)}`);
    }
    const checks: HostValidationCheck[] = [];
    for (const id of ids) checks.push(await runAllowedCheck(repositoryPath, id));
    const verifiedAt = new Date().toISOString();
    const digest = createHash("sha256").update(JSON.stringify({ repository: path.basename(repositoryPath), checks, verifiedAt })).digest("hex");
    return {
      repository: path.basename(repositoryPath),
      checks,
      passed: checks.every((check) => check.passed),
      digest,
      verifiedAt
    };
  }
}
