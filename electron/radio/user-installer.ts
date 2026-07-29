import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { UserInstallState } from "../../src/types.js";

const execute = promisify(execFile);
export function installStatePath() {
  const configured = process.env.XDG_STATE_HOME;
  const snapRelative = configured ? path.relative(path.join(os.homedir(), "snap"), configured) : "..";
  const stateHome = configured && (snapRelative.startsWith("..") || path.isAbsolute(snapRelative))
    ? configured
    : path.join(os.homedir(), ".local", "state");
  return path.join(stateHome, "asteria", "releases", "install-state.json");
}
export async function readUserInstallState(): Promise<UserInstallState> {
  try {
    const value = JSON.parse(await readFile(installStatePath(), "utf8"));
    return { currentVersion: value.currentVersion, previousVersion: value.previousVersion, currentPath: value.currentPath, previousPath: value.previousPath, transaction: value.transaction, rollbackReady: Boolean(value.rollbackReady) };
  } catch { return { rollbackReady: false }; }
}
export async function prepareUserCandidate(repositoryPath: string) {
  const root = path.resolve(repositoryPath);
  if (!existsSync(path.join(root, "package.json")) || !existsSync(path.join(root, "electron", "main.ts"))) throw new Error("User installation is available only for an Asteria source Orbit.");
  const run = async (command: string, args: string[], timeout = 30 * 60_000) => execute(command, args, { cwd: root, timeout, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, ELECTRON_RUN_AS_NODE: "" } });
  await run("npm", ["run", "typecheck"]);
  await run("npm", ["run", "build"]);
  await run("npm", ["test"]);
  await run("npm", ["run", "test:provider-contracts"]);
  await run("npm", ["run", "test:isolation"]);
  await run("npm", ["run", "test:sites"]);
  await run("npm", ["run", "test:e2e"], 45 * 60_000);
  await run("npm", ["audit", "--omit=dev", "--offline"]);
  await run(path.join(root, "node_modules", ".bin", "electron-builder"), ["--linux", "dir", "--publish", "never"]);
  await run("node", ["scripts/prepare-user-release.mjs"]);
  return { candidatePath: path.join(root, "dist", "linux-unpacked"), manifestPath: path.join(root, "dist", "user-release.json"), installerPath: path.join(root, "scripts", "install-user-release.mjs") };
}
