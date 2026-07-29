import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportPath = path.join(root, "runtime", "privacy-audit.json");
const scanRoots = ["src", "electron", "worker", "package.json"];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json"]);
const remoteAnalyticsPackages = [
  "@amplitude/analytics-browser",
  "@segment/analytics-next",
  "@sentry/electron",
  "@sentry/react",
  "mixpanel-browser",
  "posthog-js"
];
const approvedRemoteHosts = new Set(["api.github.com", "github.com", "auth.openai.com"]);

function filesWithin(target) {
  const absolute = path.join(root, target);
  if (!statSync(absolute).isDirectory()) return [absolute];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(target, entry.name);
    return entry.isDirectory() ? filesWithin(relative) : [path.join(root, relative)];
  });
}

const files = scanRoots
  .flatMap(filesWithin)
  .filter((file) => sourceExtensions.has(path.extname(file)));
const findings = [];
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

for (const dependency of remoteAnalyticsPackages) {
  if (dependencies[dependency]) {
    findings.push({ file: "package.json", rule: "remote-analytics-sdk", detail: dependency });
  }
}

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  for (const match of content.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const host = match[1].toLowerCase();
    if (
      !approvedRemoteHosts.has(host) &&
      !host.endsWith(".invalid") &&
      host !== "127.0.0.1" &&
      host !== "localhost"
    ) {
      findings.push({ file: relative, rule: "unapproved-remote-host", detail: host });
    }
  }
  if (/\b(analytics|telemetry)\.(?:track|capture|send)\s*\(/i.test(content)) {
    findings.push({ file: relative, rule: "remote-analytics-call" });
  }
}

const report = {
  schemaVersion: 1,
  application: "Asteria",
  scope: "application source and declared dependencies",
  localOnly: true,
  scannedFiles: files.length,
  findings: findings.length,
  generatedAt: new Date().toISOString(),
  status: findings.length === 0 ? "passed" : "blocked",
  details: findings
};

mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });

if (findings.length) {
  console.error(JSON.stringify(findings, null, 2));
  process.exit(1);
}

console.log(`Asteria privacy audit passed across ${files.length} source files.`);
