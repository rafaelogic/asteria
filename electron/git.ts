import { execFile } from "node:child_process";
import { cp, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function slug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "repository";
}

async function git(args: string[], cwd?: string) {
  const result = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
  });
  return result.stdout.trim();
}

async function gitRaw(args: string[], cwd?: string) {
  const result = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
  });
  return result.stdout;
}

async function snapshotUnbornRepository(repositoryRoot: string, destination: string) {
  const visibleFiles = (await gitRaw(["ls-files", "--cached", "--others", "--exclude-standard", "-z"], repositoryRoot))
    .split("\0")
    .filter(Boolean);
  for (const relative of visibleFiles) {
    const source = path.join(repositoryRoot, relative);
    const target = path.join(destination, relative);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await cp(source, target, { recursive: true, force: true, dereference: false, verbatimSymlinks: true });
  }
}

export async function cloneRepository(dataRoot: string, cloneUrl: string, projectName: string, storagePath?: string) {
  const parsed = new URL(cloneUrl);
  if (parsed.protocol !== "https:" || !["github.com"].includes(parsed.hostname)) throw new Error("Only HTTPS GitHub clone URLs are allowed.");
  const root = storagePath ? await realpath(storagePath) : path.join(dataRoot, "repositories");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const destination = path.join(root, `${slug(projectName)}-${Date.now().toString(36)}`);
  await git(["clone", "--origin", "origin", "--", parsed.toString(), destination]);
  return { path: await realpath(destination) };
}

export async function repositoryStatus(repositoryPath: string) {
  const root = await realpath(repositoryPath);
  const top = await git(["rev-parse", "--show-toplevel"], root);
  if (await realpath(top) !== root) throw new Error("Selected path must be the Git repository root.");
  const branch = await git(["branch", "--show-current"], root);
  const porcelain = await git(["status", "--porcelain=v1", "-z"], root);
  const changedFiles = porcelain.split("\0").filter(Boolean).map((line) => line.slice(3));
  return { branch: branch || "detached", clean: changedFiles.length === 0, changedFiles };
}

export async function createTaskWorktree(dataRoot: string, projectId: string, taskId: string, repositoryPath: string, branch: string) {
  const repositoryRoot = await realpath(repositoryPath);
  const worktreesRoot = path.join(dataRoot, "projects", slug(projectId), "worktrees");
  await mkdir(worktreesRoot, { recursive: true, mode: 0o700 });
  const destination = path.join(worktreesRoot, slug(taskId));
  const safeBranch = `asteria/${slug(branch)}`;
  const hasHead = await git(["rev-parse", "--verify", "HEAD"], repositoryRoot).then(() => true, () => false);
  if (hasHead) {
    await git(["worktree", "add", "-b", safeBranch, "--", destination, "HEAD"], repositoryRoot);
  } else {
    await git(["worktree", "add", "--orphan", "-b", safeBranch, "--", destination], repositoryRoot);
    await snapshotUnbornRepository(repositoryRoot, destination);
  }
  return { path: await realpath(destination), branch: safeBranch };
}

export async function checkpoint(worktreePath: string, message: string) {
  const root = await realpath(worktreePath);
  await git(["add", "--all"], root);
  const changed = await git(["status", "--porcelain"], root);
  if (!changed) return { commit: await git(["rev-parse", "HEAD"], root) };
  await git(["commit", "-m", message.slice(0, 200)], root);
  return { commit: await git(["rev-parse", "HEAD"], root) };
}
