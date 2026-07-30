import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

function resolvePackage(input) {
  if (input) return realpathSync(path.resolve(input));
  const dist = path.resolve("dist");
  const candidates = existsSync(dist)
    ? readdirSync(dist)
        .filter((name) => /^asteria_.+_(?:amd64|arm64)\.deb$/.test(name))
        .map((name) => path.join(dist, name))
        .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
    : [];
  if (!candidates[0]) throw new Error("No Asteria .deb package was found in dist.");
  return realpathSync(candidates[0]);
}

const source = resolvePackage(process.argv[2]);
if (path.extname(source) !== ".deb" || !statSync(source).isFile()) {
  throw new Error(`Expected an Asteria .deb file, received: ${source}`);
}

// APT downloads local packages through its restricted `_apt` user. Project
// directories commonly block traversal, so stage the package in an isolated
// but traversable location instead of weakening source-directory permissions.
const stagingRoot = mkdtempSync(path.join(os.tmpdir(), "asteria-deb-"));
const stagedPackage = path.join(stagingRoot, path.basename(source));

try {
  chmodSync(stagingRoot, 0o755);
  copyFileSync(source, stagedPackage);
  chmodSync(stagedPackage, 0o644);

  const elevated = typeof process.getuid === "function" && process.getuid() !== 0;
  const command = elevated ? "sudo" : "apt-get";
  const args = elevated
    ? ["apt-get", "install", "-y", stagedPackage]
    : ["install", "-y", stagedPackage];
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`APT installation exited with code ${result.status ?? "unknown"}.`);
} finally {
  rmSync(stagingRoot, { recursive: true, force: true });
}
