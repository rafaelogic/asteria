import { z } from "zod";

const id = z.string().regex(/^[a-z0-9][a-z0-9.-]{2,79}$/);
export const OrbitSkillSchema = z.object({
  schemaVersion: z.literal(1), id, name: z.string().min(1).max(120), version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1).max(500), roles: z.array(z.string()).min(1).max(20),
  coordinates: z.array(z.string().min(1).max(80)).min(1).max(30),
  providers: z.array(z.enum(["codex", "claude"])).min(1),
  platforms: z.array(z.enum(["linux", "darwin", "win32"])).min(1),
  requiredCapabilities: z.array(z.enum(["filesystem", "command", "git", "github", "provider", "research", "browser", "packages", "tests", "deployment", "observability", "notifications", "approvals"])).max(20),
  requiredAdapters: z.array(id).max(20), dependencies: z.array(id).max(20).default([]),
  risk: z.enum(["read", "workspace_write", "external_mutation", "destructive"]),
  permissions: z.array(z.enum(["filesystem_read", "filesystem_write", "command_execute", "git_write", "network_read", "external_mutation", "deployment", "production"])).max(20),
  inputSchema: z.record(z.string(), z.unknown()).default({}), outputSchema: z.record(z.string(), z.unknown()).default({}),
  preconditions: z.array(z.string().max(500)).max(30).default([]), successCriteria: z.array(z.string().max(500)).max(30).default([]),
  validationCommands: z.array(z.string().max(500)).max(20).default([]), timeoutSeconds: z.number().int().min(10).max(7200).default(1800),
  maxRetries: z.number().int().min(0).max(3).default(3), checkpoint: z.boolean().default(true),
  rollback: z.string().max(2000).default("Leave changes isolated for review."), redaction: z.array(z.string().max(120)).max(30).default([]),
  evidence: z.array(z.string().max(120)).max(30).default([]), compatibility: z.string().max(80).default(">=0.2.0 <1.0.0"),
  instructions: z.string().min(1).max(20000)
}).strict();
