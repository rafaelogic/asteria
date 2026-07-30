import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveUserPath, sanitizedDesktopEnvironment } from "./user-paths.mjs";

process.umask(0o077);
const taskHome = os.homedir();
const dataHome = resolveUserPath("XDG_DATA_HOME", [".local", "share"]);
const stateHome = resolveUserPath("XDG_STATE_HOME", [".local", "state"]);
const configHome = resolveUserPath("XDG_CONFIG_HOME", [".config"]);
const binHome = path.join(taskHome, ".local", "bin");
const appRoot = path.join(dataHome, "asteria");
const versionsRoot = path.join(appRoot, "versions");
const releaseStateRoot = path.join(stateHome, "asteria", "releases");
const currentLink = path.join(appRoot, "current");
const previousLink = path.join(appRoot, "previous");
const statePath = path.join(releaseStateRoot, "install-state.json");
const candidate = path.resolve(process.argv[2] || "dist/linux-unpacked");
const manifestPath = path.resolve(process.argv[3] || "dist/user-release.json");
const rollback = process.argv.includes("--rollback");
const launch = process.argv.includes("--launch");
const applicationEnvironment = sanitizedDesktopEnvironment();
const launchArguments = ["--ozone-platform=x11", "--disable-gpu", "--no-sandbox"];
const launcherLog = path.join(stateHome, "asteria", "launcher.log");
delete applicationEnvironment.ELECTRON_RUN_AS_NODE;
let handlingFatalError = false;

function ensureDirectory(directory, mode = 0o700) {
  mkdirSync(directory, { recursive: true, mode });
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe Asteria directory: ${directory}`);
  chmodSync(directory, mode);
}
function hardenPrivateTree(root) {
  if (!existsSync(root)) return;
  const stat = lstatSync(root);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    chmodSync(root, 0o700);
    for (const name of readdirSync(root)) hardenPrivateTree(path.join(root, name));
  } else if (stat.isFile()) {
    chmodSync(root, stat.mode & 0o100 ? 0o700 : 0o600);
  }
}
function linkTarget(link) { try { return realpathSync(link); } catch { return undefined; } }
function launchKnownGood() {
  if (!launch) return;
  const current = linkTarget(currentLink);
  if (!current) return;
  const executable = path.join(current, "asteria");
  if (!existsSync(executable)) return;
  const child = spawn(executable, launchArguments, { detached: true, stdio: "ignore", env: applicationEnvironment });
  child.unref();
}
function recoverFromFatalError(error) {
  if (handlingFatalError) return;
  handlingFatalError = true;
  const detail = error instanceof Error ? error.message : String(error);
  try {
    ensureDirectory(releaseStateRoot);
    const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
    writeFileSync(statePath, JSON.stringify({
      ...state,
      status: "failed",
      failure: detail,
      failedAt: new Date().toISOString(),
    }, null, 2), { mode: 0o600 });
    hardenPrivateTree(releaseStateRoot);
  } catch {
    // A read-only or unavailable state directory must not prevent recovery.
  }
  try { launchKnownGood(); } catch {}
  console.error(`Asteria user installation failed: ${detail}`);
  process.exitCode = 1;
}
process.on("uncaughtException", recoverFromFatalError);
process.on("unhandledRejection", recoverFromFatalError);
for (const directory of [versionsRoot, releaseStateRoot, binHome, path.join(dataHome, "applications"), path.join(dataHome, "icons", "hicolor", "512x512", "apps")]) ensureDirectory(directory);

function legacySnapTarget() {
  const codeSnapRoot = path.join(taskHome, "snap", "code");
  try {
    return readdirSync(codeSnapRoot)
      .map((revision) => ({ revision, target: linkTarget(path.join(codeSnapRoot, revision, ".local", "share", "asteria", "current")) }))
      .filter((entry) => entry.target)
      .sort((left, right) => right.revision.localeCompare(left.revision, undefined, { numeric: true }))[0]?.target;
  } catch {
    return undefined;
  }
}
function atomicLink(target, link) {
  const temporary = `${link}.next-${randomUUID()}`;
  symlinkSync(target, temporary);
  renameSync(temporary, link);
}
function hashFile(file) { return createHash("sha256").update(readFileSync(file)).digest("hex"); }
function verify(root, manifest) {
  const rootReal = realpathSync(root);
  for (const file of manifest.files) {
    if (path.isAbsolute(file.path) || file.path.split(path.sep).includes("..")) throw new Error(`Unsafe manifest path: ${file.path}`);
    const target = path.join(rootReal, file.path);
    const stat = lstatSync(target);
    if (!stat.isFile() || (stat.mode & 0o6000) !== 0 || stat.size !== file.size || hashFile(target) !== file.sha256) throw new Error(`Candidate verification failed: ${file.path}`);
    if (!realpathSync(target).startsWith(`${rootReal}${path.sep}`)) throw new Error(`Candidate escaped version root: ${file.path}`);
  }
  const digest = createHash("sha256").update(JSON.stringify(manifest.files)).digest("hex");
  if (digest !== manifest.artifactDigest) throw new Error("Release manifest digest mismatch.");
}
function snapshotStorage(version) {
  const profile = path.join(configHome, "asteria");
  if (!existsSync(profile)) return undefined;
  const destination = path.join(releaseStateRoot, `snapshot-${version}-${Date.now()}`);
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  for (const name of ["asteria.sqlite3", "asteria.sqlite3-wal", "asteria.sqlite3-shm", "vault", "credentials"]) {
    const source = path.join(profile, name);
    if (existsSync(source)) cpSync(source, path.join(destination, name), { recursive: true, force: true, dereference: false });
  }
  return destination;
}
async function canary(executable, version) {
  const canaryRoot = path.join(releaseStateRoot, `canary-${version}-${Date.now()}`);
  const heartbeat = path.join(canaryRoot, "healthy.json");
  mkdirSync(canaryRoot, { recursive: true, mode: 0o700 });
  const child = spawn(executable, [`--user-data-dir=${path.join(canaryRoot, "profile")}`, "--password-store=basic", ...launchArguments], { env: { ...applicationEnvironment, ASTERIA_HEALTHCHECK_FILE: heartbeat }, stdio: "ignore" });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !existsSync(heartbeat) && child.exitCode === null) await new Promise((resolve) => setTimeout(resolve, 250));
  child.kill();
  if (!existsSync(heartbeat)) throw new Error("Candidate did not produce a healthy startup heartbeat.");
  const health = JSON.parse(readFileSync(heartbeat, "utf8"));
  rmSync(canaryRoot, { recursive: true, force: true });
  return health;
}

if (rollback) {
  const previous = linkTarget(previousLink);
  if (!previous) throw new Error("No previous verified Asteria version is available.");
  const current = linkTarget(currentLink);
  atomicLink(previous, currentLink);
  if (current) atomicLink(current, previousLink);
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
  if (state.snapshot && existsSync(state.snapshot)) {
    const profile = path.join(configHome, "asteria");
    ensureDirectory(profile);
    for (const name of readdirSync(state.snapshot)) {
      cpSync(path.join(state.snapshot, name), path.join(profile, name), {
        recursive: true,
        force: true,
        dereference: false,
      });
    }
    hardenPrivateTree(profile);
  }
  writeFileSync(statePath, JSON.stringify({ ...state, status: "rolled_back", currentPath: previous, previousPath: current, completedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  if (launch) { const child = spawn(path.join(previous, "asteria"), launchArguments, { detached: true, stdio: "ignore", env: applicationEnvironment }); child.unref(); }
  console.log(`Rolled back Asteria to ${previous}`);
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
verify(candidate, manifest);
const versionPath = path.join(versionsRoot, `${manifest.version}-${manifest.commit.slice(0, 12)}`);
const temporary = `${versionPath}.tmp-${randomUUID()}`;
rmSync(temporary, { recursive: true, force: true });
cpSync(candidate, temporary, { recursive: true, force: true, dereference: false });
verify(temporary, manifest);
const health = await canary(path.join(temporary, "asteria"), manifest.version);
rmSync(versionPath, { recursive: true, force: true });
renameSync(temporary, versionPath);
const current = linkTarget(currentLink) ?? legacySnapTarget();
const snapshot = snapshotStorage(manifest.version);
if (current && current !== versionPath) atomicLink(current, previousLink);
atomicLink(versionPath, currentLink);
writeFileSync(path.join(binHome, "asteria"), `#!/bin/sh\nunset ELECTRON_RUN_AS_NODE\nexec "${currentLink}/asteria" ${launchArguments.join(" ")} "$@" </dev/null >>"${launcherLog}" 2>&1\n`, { mode: 0o755 });
// A user desktop file with the same ID takes precedence over the legacy system
// package while preserving the launcher identity already cached by desktop shells.
const desktopEntry = path.join(dataHome, "applications", "asteria.desktop");
writeFileSync(desktopEntry, `[Desktop Entry]\nName=Asteria\nComment=Agentic workflow control plane\nExec=${path.join(binHome, "asteria")}\nTryExec=${path.join(binHome, "asteria")}\nIcon=asteria\nTerminal=false\nType=Application\nStartupWMClass=asteria\nStartupNotify=true\nDBusActivatable=false\nCategories=Development;\n`, { mode: 0o755 });
chmodSync(desktopEntry, 0o755);
rmSync(path.join(dataHome, "applications", "dev.asteria.Asteria.desktop"), { force: true });
const icon = path.join(versionPath, "resources", "app.asar.unpacked", "build", "icon.png");
const fallbackIcon = path.resolve("build/icons/512x512/apps/asteria.png");
if (existsSync(icon) || existsSync(fallbackIcon)) cpSync(existsSync(icon) ? icon : fallbackIcon, path.join(dataHome, "icons", "hicolor", "512x512", "apps", "asteria.png"));
spawnSync("update-desktop-database", [path.join(dataHome, "applications")], { env: applicationEnvironment, stdio: "ignore" });
for (const name of readdirSync(versionsRoot).filter((name) => ![path.basename(versionPath), current ? path.basename(current) : ""].includes(name))) rmSync(path.join(versionsRoot, name), { recursive: true, force: true });
const state = {
  status: "healthy",
  currentVersion: manifest.version,
  currentPath: versionPath,
  previousVersion: current ? path.basename(current).split("-")[0] : undefined,
  previousPath: current,
  rollbackReady: Boolean(current),
  snapshot,
  manifest,
  health,
  completedAt: new Date().toISOString(),
};
writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
hardenPrivateTree(releaseStateRoot);
if (launch) { const child = spawn(path.join(versionPath, "asteria"), launchArguments, { detached: true, stdio: "ignore", env: applicationEnvironment }); child.unref(); }
console.log(`Installed Asteria ${manifest.version} for ${os.userInfo().username} at ${versionPath}`);
