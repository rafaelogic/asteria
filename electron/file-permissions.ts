import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

export function ensurePrivateDirectory(directory: string) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe Asteria directory: ${directory}`);
  chmodSync(directory, 0o700);
}

export function ensurePrivateFile(file: string) {
  if (!existsSync(file)) return;
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Unsafe Asteria file: ${file}`);
  chmodSync(file, stat.mode & 0o100 ? 0o700 : 0o600);
}

export function hardenPrivateTree(root: string) {
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

export function prepareApplicationData(userData: string) {
  ensurePrivateDirectory(userData);
  for (const name of [
    "auth",
    "credentials",
    "maintenance-radio",
    "preview-evidence",
    "provider-accounts",
    "provider-profiles",
    "recovery",
    "sessions",
    "vault",
    "worktrees",
  ]) {
    hardenPrivateTree(path.join(userData, name));
  }
  for (const name of [
    "asteria.sqlite3",
    "asteria.sqlite3-shm",
    "asteria.sqlite3-wal",
    "recovery-state.json",
  ]) {
    ensurePrivateFile(path.join(userData, name));
  }
}
