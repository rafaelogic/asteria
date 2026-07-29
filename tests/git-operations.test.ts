import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkpoint, createTaskWorktree, repositoryStatus } from "../electron/git";

describe("isolated Git operations", () => {
  it("creates task worktrees and checkpoint commits without changing the source worktree", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "asteria-git-test-"));
    const repository = path.join(root, "source");
    execFileSync("git", ["init", repository]);
    execFileSync("git", ["config", "user.email", "test@asteria.local"], { cwd: repository });
    execFileSync("git", ["config", "user.name", "Asteria Test"], { cwd: repository });
    writeFileSync(path.join(repository, "README.md"), "source\n");
    execFileSync("git", ["add", "README.md"], { cwd: repository });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: repository });
    try {
      const worktree = await createTaskWorktree(root, "project_one", "task_one", repository, "task-one");
      writeFileSync(path.join(worktree.path, "README.md"), "worktree\n");
      const result = await checkpoint(worktree.path, "test checkpoint");
      expect(result.commit).toMatch(/^[0-9a-f]{40}$/);
      expect((await repositoryStatus(repository)).clean).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
