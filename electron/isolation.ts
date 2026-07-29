import { cp, mkdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { ProviderId } from "../src/types.js";

export interface IsolationContext {
  sessionId: string;
  workspaceRoot: string;
  appHome: string;
  providerHome: string;
  worktreePath: string;
  allowedRoots: string[];
  env: NodeJS.ProcessEnv;
}

function assertInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Resolved path escapes the Asteria data root.");
}

export async function createIsolationContext(
  userData: string,
  sessionId: string,
  workspace: string,
  provider: ProviderId,
  profileId?: string
): Promise<IsolationContext> {
  const workspaceRoot = await realpath(workspace);
  const sessionsRoot = path.join(userData, "sessions");
  const appHome = path.join(sessionsRoot, sessionId, "home");
  const providerHome = path.join(appHome, provider);
  const providerConfigHome = path.join(providerHome, provider === "codex" ? ".codex" : ".claude");
  const worktreePath = path.join(sessionsRoot, sessionId, "worktree");
  const tempRoot = path.join(sessionsRoot, sessionId, "tmp");
  [appHome, providerHome, worktreePath, tempRoot].forEach((target) => assertInside(sessionsRoot, target));
  await Promise.all([appHome, providerHome, providerConfigHome, worktreePath, tempRoot].map((target) => mkdir(target, { recursive: true, mode: 0o700 })));
  const profileSource = profileId
    ? path.join(userData, "provider-accounts", profileId, provider)
    : path.join(userData, "provider-profiles", provider, provider);
  try {
    if ((await stat(profileSource)).isDirectory()) await cp(profileSource, providerHome, { recursive: true, force: false, errorOnExist: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    LANG: process.env.LANG ?? "en_US.UTF-8",
    HOME: appHome,
    USERPROFILE: appHome,
    XDG_CONFIG_HOME: path.join(appHome, ".config"),
    XDG_CACHE_HOME: path.join(appHome, ".cache"),
    XDG_DATA_HOME: path.join(appHome, ".local", "share"),
    CODEX_HOME: path.join(providerHome, ".codex"),
    CLAUDE_CONFIG_DIR: path.join(providerHome, ".claude"),
    TMPDIR: tempRoot,
    TEMP: tempRoot,
    TMP: tempRoot,
    GIT_TERMINAL_PROMPT: "0",
    NO_COLOR: "1"
  };
  if (process.env.ASTERIA_NETWORK_PROXY) {
    env.HTTP_PROXY = process.env.ASTERIA_NETWORK_PROXY;
    env.HTTPS_PROXY = process.env.ASTERIA_NETWORK_PROXY;
    env.ALL_PROXY = process.env.ASTERIA_NETWORK_PROXY;
    env.NO_PROXY = "127.0.0.1,localhost";
  }

  return { sessionId, workspaceRoot, appHome, providerHome, worktreePath, allowedRoots: [workspaceRoot, worktreePath], env };
}

export async function createProviderProfileContext(userData: string, provider: ProviderId, profileId?: string): Promise<IsolationContext> {
  const profilesRoot = profileId ? path.join(userData, "provider-accounts") : path.join(userData, "provider-profiles");
  const appHome = profileId ? path.join(profilesRoot, profileId) : path.join(profilesRoot, provider);
  const providerHome = path.join(appHome, provider);
  const providerConfigHome = path.join(providerHome, provider === "codex" ? ".codex" : ".claude");
  const tempRoot = path.join(appHome, "tmp");
  await Promise.all([appHome, providerHome, providerConfigHome, tempRoot].map((target) => mkdir(target, { recursive: true, mode: 0o700 })));
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    LANG: process.env.LANG ?? "en_US.UTF-8",
    HOME: appHome,
    USERPROFILE: appHome,
    XDG_CONFIG_HOME: path.join(appHome, ".config"),
    XDG_CACHE_HOME: path.join(appHome, ".cache"),
    XDG_DATA_HOME: path.join(appHome, ".local", "share"),
    CODEX_HOME: path.join(providerHome, ".codex"),
    CLAUDE_CONFIG_DIR: path.join(providerHome, ".claude"),
    TMPDIR: tempRoot,
    TEMP: tempRoot,
    TMP: tempRoot,
    NO_COLOR: "1"
  };
  if (process.env.ASTERIA_NETWORK_PROXY) {
    env.HTTP_PROXY = process.env.ASTERIA_NETWORK_PROXY;
    env.HTTPS_PROXY = process.env.ASTERIA_NETWORK_PROXY;
    env.ALL_PROXY = process.env.ASTERIA_NETWORK_PROXY;
    env.NO_PROXY = "127.0.0.1,localhost";
  }
  return { sessionId: `auth_${provider}_${profileId ?? "default"}`, workspaceRoot: appHome, appHome, providerHome, worktreePath: appHome, allowedRoots: [appHome], env };
}
