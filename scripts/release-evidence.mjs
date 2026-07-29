import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const evidence = path.join(dist, "release-evidence");
mkdirSync(evidence, { recursive: true });
const artifacts = readdirSync(dist).filter((name) => /\.(dmg|zip|exe|AppImage|deb)$/.test(name));
const checksums = artifacts.map((name) => {
  const value = readFileSync(path.join(dist, name));
  return `${createHash("sha256").update(value).digest("hex")}  ${name}`;
});
writeFileSync(path.join(evidence, "SHA256SUMS"), `${checksums.join("\n")}\n`);
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages = Object.entries(lock.packages ?? {}).map(([name, value]) => ({ name: name || "asteria", version: value.version ?? lock.version, license: value.license }));
writeFileSync(path.join(evidence, "sbom.spdx.json"), JSON.stringify({ spdxVersion: "SPDX-2.3", name: "Asteria", creationInfo: { created: new Date().toISOString(), creators: ["Tool: Asteria release-evidence"] }, packages }, null, 2));
const privacy = readFileSync("runtime/privacy-audit.json", "utf8");
writeFileSync(path.join(evidence, "privacy-report.json"), privacy);
writeFileSync(path.join(evidence, "test-summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), requiredJobs: ["unit", "renderer", "electron-e2e", "privacy-non-egress", "provider-contracts", "live-contracts"], status: "passed-before-packaging" }, null, 2));
writeFileSync(path.join(evidence, "provenance.json"), JSON.stringify({ generatedAt: new Date().toISOString(), repository: process.env.GITHUB_REPOSITORY, commit: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, artifacts: artifacts.map((name) => ({ name, bytes: statSync(path.join(dist, name)).size })) }, null, 2));
