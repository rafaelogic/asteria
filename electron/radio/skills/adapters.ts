import type { CapabilityAdapter, SkillCapability } from "../../../src/types.js";

const definitions: Array<[string, SkillCapability, string[]]> = [
  ["filesystem", "filesystem", ["read", "list", "write-scoped"]], ["command", "command", ["execute-scoped", "cancel"]],
  ["git", "git", ["status", "clone", "branch", "worktree", "checkpoint", "commit", "rebase"]],
  ["github", "github", ["repository", "issue", "branch", "pull-request", "checks", "review"]],
  ["provider", "provider", ["start", "cancel", "relay"]], ["research", "research", ["search", "fetch-cited"]],
  ["browser", "browser", ["navigate", "inspect", "screenshot"]], ["packages", "packages", ["detect", "install", "audit"]],
  ["tests", "tests", ["run", "collect"]], ["deployment", "deployment", ["preflight", "stage", "promote", "rollback"]],
  ["observability", "observability", ["health", "logs"]], ["notifications", "notifications", ["report"]],
  ["approvals", "approvals", ["request", "consume"]]
];
export const CAPABILITY_ADAPTERS: CapabilityAdapter[] = definitions.map(([id, capability, operations]) => ({ id, capability, operations, available: true }));
