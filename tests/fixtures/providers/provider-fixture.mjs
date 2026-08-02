#!/usr/bin/env node
const provider = process.argv[2] ?? "fixture";
if (process.argv.includes("--version")) {
  process.stdout.write(provider === "codex" ? "codex-cli 0.146.0" : "claude 2.1.0");
  process.exit(0);
}
if (process.argv.includes("login") || process.argv.includes("auth")) {
  process.stdout.write(JSON.stringify({ type: "message", content: `${provider} fixture authenticated` }) + "\n");
  process.exit(0);
}
const malformed = process.env.ASTERIA_PROVIDER_FIXTURE_MODE === "malformed";
const crash = process.env.ASTERIA_PROVIDER_FIXTURE_MODE === "crash";
process.stdout.write(JSON.stringify({ type: "reasoning", content: "Inspecting approved stage contract" }) + "\n");
process.stdout.write(JSON.stringify({ type: "tool_start", content: "fixture-tool" }) + "\n");
if (malformed) process.stdout.write('{"type":\n');
process.stdout.write(JSON.stringify({ type: "tool_result", content: "Fixture evidence generated; token sk-proj-secret-redacted" }) + "\n");
process.stdout.write(JSON.stringify({ type: "message", content: "Improved maintenance prompt with clear verification criteria." }) + "\n");
process.stdout.write(JSON.stringify({ type: "usage", content: "100 input, 40 output" }) + "\n");
process.exit(crash ? 17 : 0);
