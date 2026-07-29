import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve("dist/linux-unpacked");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const files = [];
function walk(directory) {
  for (const name of readdirSync(directory).sort()) {
    const target = path.join(directory, name);
    const relative = path.relative(root, target);
    const stat = lstatSync(target);
    if (stat.isSymbolicLink() || stat.isSocket() || stat.isBlockDevice() || stat.isCharacterDevice() || stat.isFIFO()) throw new Error(`Unsafe candidate entry: ${relative}`);
    if ((stat.mode & 0o6000) !== 0) throw new Error(`Unsafe privileged mode: ${relative}`);
    if (stat.isDirectory()) walk(target);
    else if (stat.isFile()) files.push({ path: relative, size: stat.size, mode: stat.mode & 0o777, sha256: createHash("sha256").update(readFileSync(target)).digest("hex") });
    else throw new Error(`Unsupported candidate entry: ${relative}`);
  }
}
walk(root);
const sourceDigest = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const artifactDigest = createHash("sha256").update(JSON.stringify(files)).digest("hex");
const manifest = {
  schemaVersion: 1, version: packageJson.version, commit: sourceDigest, sourceDigest,
  artifactDigest, checks: ["privacy", "typecheck", "unit", "provider", "isolation", "release", "sites", "web-build", "electron-build"],
  files, createdAt: new Date().toISOString()
};
writeFileSync("dist/user-release.json", JSON.stringify(manifest, null, 2), { mode: 0o600 });
console.log(`Prepared user release ${manifest.version} (${files.length} files, ${artifactDigest.slice(0, 12)})`);
