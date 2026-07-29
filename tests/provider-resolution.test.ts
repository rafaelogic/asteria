import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveProviderCommand } from "../electron/providers";

describe("provider executable resolution", () => {
  it("finds Codex bundled by the official OpenAI VS Code extension", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "asteria-provider-home-"));
    const command = path.join(home, ".vscode", "extensions", "openai.chatgpt-99.0.0-linux-x64", "bin", "linux-x86_64", "codex");
    mkdirSync(path.dirname(command), { recursive: true });
    writeFileSync(command, "#!/bin/sh\nexit 0\n");
    chmodSync(command, 0o755);
    try {
      expect(resolveProviderCommand("codex", { home, env: { PATH: "" } })).toBe(command);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("prefers an executable already available on PATH", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "asteria-provider-path-"));
    const command = path.join(home, "bin", "codex");
    mkdirSync(path.dirname(command), { recursive: true });
    writeFileSync(command, "#!/bin/sh\nexit 0\n");
    chmodSync(command, 0o755);
    try {
      expect(resolveProviderCommand("codex", { home, env: { PATH: path.dirname(command) } })).toBe(command);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
