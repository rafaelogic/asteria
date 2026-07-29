import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createIsolationContext } from "../electron/isolation";

function digest(root: string) {
  const hash = createHash("sha256");
  const walk = (directory: string) => readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((entry) => {
    const target = path.join(directory, entry.name); hash.update(path.relative(root, target));
    if (entry.isDirectory()) walk(target); else hash.update(readFileSync(target));
  });
  walk(root); return hash.digest("hex");
}

describe("shared profile non-interference", () => {
  it.each(["codex", "claude", "browser", "git", "vscode"])("does not change populated %s profiles", async (profile) => {
    const root = mkdtempSync(path.join(os.tmpdir(), `asteria-${profile}-`));
    const shared = path.join(root, "shared", profile); const workspace = path.join(root, "repo");
    mkdirSync(shared, { recursive: true }); mkdirSync(workspace);
    writeFileSync(path.join(shared, "credentials.json"), `fixture-${profile}-secret`);
    const before = digest(shared);
    const context = await createIsolationContext(path.join(root, "asteria"), `session_${profile}`, workspace, profile === "claude" ? "claude" : "codex");
    expect(context.env.HOME).not.toContain(shared);
    expect(context.allowedRoots).not.toContain(shared);
    expect(digest(shared)).toBe(before);
  });
});
