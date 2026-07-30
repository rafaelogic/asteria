import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkpoint, cleanupTaskWorktree, createTaskWorktree, repositoryStatus } from "../electron/git";

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
      await cleanupTaskWorktree(repository, worktree.path, worktree.branch);
      expect(existsSync(worktree.path)).toBe(false);
      expect(spawnSync("git", ["show-ref", "--verify", `refs/heads/${worktree.branch}`], { cwd: repository }).status).not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates an isolated first commit when the source repository has no HEAD", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "asteria-unborn-git-test-"));
    const repository = path.join(root, "source");
    execFileSync("git", ["init", repository]);
    execFileSync("git", ["config", "user.email", "test@asteria.local"], { cwd: repository });
    execFileSync("git", ["config", "user.name", "Asteria Test"], { cwd: repository });
    writeFileSync(path.join(repository, ".gitignore"), "node_modules/\n.env\n");
    writeFileSync(path.join(repository, "README.md"), "unborn source\n");
    writeFileSync(path.join(repository, ".env"), "SECRET=not-copied\n");
    mkdirSync(path.join(repository, "node_modules"));
    writeFileSync(path.join(repository, "node_modules", "ignored.js"), "ignored\n");
    try {
      const worktree = await createTaskWorktree(root, "project_unborn", "task_unborn", repository, "define-task");
      expect(readFileSync(path.join(worktree.path, "README.md"), "utf8")).toBe("unborn source\n");
      expect(existsSync(path.join(worktree.path, ".env"))).toBe(false);
      expect(existsSync(path.join(worktree.path, "node_modules"))).toBe(false);
      const result = await checkpoint(worktree.path, "initial isolated checkpoint");
      expect(result.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(spawnSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: repository }).status).not.toBe(0);
      expect(readFileSync(path.join(repository, "README.md"), "utf8")).toBe("unborn source\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
