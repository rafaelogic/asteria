import { spawnSync } from "node:child_process";

const missing = [];
if (!process.env.ASTERIA_GITHUB_CLIENT_ID) missing.push("ASTERIA_GITHUB_CLIENT_ID");
if (process.env.ASTERIA_REQUIRE_LIVE_CLAUDE === "1") {
  const claude = spawnSync("claude", ["--version"], { encoding: "utf8", shell: false });
  if (claude.status !== 0) missing.push("live Claude CLI");
}
if (missing.length) {
  process.stderr.write(`Protected release gates unavailable: ${missing.join(", ")}\n`);
  process.exit(1);
}
process.stdout.write("Protected live credential prerequisites are present. Device Flow and mutation approval remain human-gated.\n");
