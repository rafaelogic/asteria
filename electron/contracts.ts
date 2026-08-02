import { z } from "zod";

export const ProviderIdSchema = z.enum(["codex", "claude"]);
export const SpecialistRoleSchema = z.enum(["planner", "product_designer", "ui_designer", "architect", "frontend", "backend", "database", "devops", "integrator", "reviewer", "qa", "security", "accessibility", "performance"]);
export const IdempotencyKeySchema = z.string().min(8).max(128).regex(/^[a-zA-Z0-9:_-]+$/);
export const StartRunSchema = z.object({
  projectId: z.string().min(4).max(80),
  runId: z.string().min(4).max(80),
  provider: ProviderIdSchema,
  role: SpecialistRoleSchema,
  prompt: z.string().min(1).max(200_000),
  workspace: z.string().min(1).max(4096),
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{4,80}$/)
  ,profileId: z.string().uuid().optional()
});
export const IsolationSchema = z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{4,80}$/),
  workspace: z.string().min(1).max(4096),
  provider: ProviderIdSchema
});
export const DeviceFlowSchema = z.object({ clientId: z.string().min(8).max(128) });
export const PollFlowSchema = z.object({
  clientId: z.string().min(8).max(128),
  deviceCode: z.string().min(8),
  interval: z.number().min(1).max(30)
});
export const TelemetryPolicySchema = z.object({
  enabled: z.boolean(),
  replayEnabled: z.boolean(),
  retentionDays: z.number().int().min(1).max(3650),
  quotaBytes: z.number().int().min(10 * 1024 * 1024).max(1024 * 1024 * 1024 * 1024),
  projectOverrides: z.record(z.string(), z.object({
    enabled: z.boolean().optional(),
    replayEnabled: z.boolean().optional(),
    retentionDays: z.number().int().min(1).max(3650).optional(),
    quotaBytes: z.number().int().optional()
  })).optional()
});
export const RaDioModeSchema = z.enum(["autonomous", "full_autonomous"]);
export const RaDioSettingsSchema = z.object({
  mode: RaDioModeSchema,
  enabled: z.boolean(),
  stagingBranch: z.string().min(1).max(240).regex(/^[A-Za-z0-9._/-]+$/),
  stagingTarget: z.string().max(240).optional(),
  mergeProductionEnabled: z.boolean(),
  productionTarget: z.string().max(240).optional(),
  maxRepairAttempts: z.number().int().min(1).max(3),
  dailyScout: z.boolean(),
  emergencyStopped: z.boolean(),
  skillsEnabled: z.boolean().default(true),
  enabledSkillIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9.-]{2,79}$/)).max(100).default([]),
  disabledSkillIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9.-]{2,79}$/)).max(100).default([]),
  approvedOrbitSkillDigests: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)).default({}),
  memoryEnabled: z.boolean().default(false),
  ownerMemoryEnabled: z.boolean().default(false),
  takeoverEnabled: z.boolean().default(false),
  healthMonitoringEnabled: z.boolean().default(true),
  autoResume: z.boolean().default(true),
  autoPushStaging: z.boolean().default(true),
  autoBuild: z.boolean().default(true),
  autoInstall: z.boolean().default(true),
  installChannel: z.literal("user").default("user"),
  rollbackRetention: z.literal(1).default(1),
  accountPool: z.object({
    enabled: z.boolean(), thresholdPercent: z.literal(5), crossProvider: z.boolean(),
    accountIds: z.array(z.string().uuid()).max(20),
    rolePins: z.record(SpecialistRoleSchema, z.string().uuid()).optional()
  })
});
export const OnboardingSchema = z.object({
  step: z.number().int().min(0).max(8),
  providers: z.array(ProviderIdSchema),
  defaultProvider: ProviderIdSchema,
  githubConnected: z.boolean(),
  repository: z.string().max(500),
  repositoryPath: z.string().min(1).max(4096),
  repositoryStoragePath: z.string().max(4096),
  projectName: z.string().min(1).max(120),
  idea: z.string().min(10).max(20_000),
  audience: z.string().max(2_000),
  constraints: z.string().max(4_000),
  roles: z.array(SpecialistRoleSchema).optional(),
  radio: RaDioSettingsSchema.default({
    mode: "autonomous", enabled: true, stagingBranch: "staging", mergeProductionEnabled: false,
    maxRepairAttempts: 3, dailyScout: true, emergencyStopped: false,
    skillsEnabled: true, enabledSkillIds: [], disabledSkillIds: [], approvedOrbitSkillDigests: {},
    memoryEnabled: false, ownerMemoryEnabled: false,
    takeoverEnabled: false, healthMonitoringEnabled: true, autoResume: true, autoPushStaging: true,
    autoBuild: true, autoInstall: true, installChannel: "user", rollbackRetention: 1,
    accountPool: { enabled: false, thresholdPercent: 5, crossProvider: true, accountIds: [] }
  }),
  telemetry: TelemetryPolicySchema,
  idempotencyKey: IdempotencyKeySchema
});
export const MutationSchema = z.object({
  projectId: z.string().min(4).max(80),
  runId: z.string().min(4).max(80),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: IdempotencyKeySchema
});
export const WorkflowMutationSchema = MutationSchema.extend({
  event: z.enum(["complete", "fail_review", "fail_qa", "approve", "pause", "resume"])
});
export const ProjectUpdateSchema = MutationSchema.extend({
  patch: z.object({
    name: z.string().min(1).max(120).optional(),
    objective: z.string().min(1).max(20_000).optional(),
    repository: z.string().min(1).max(500).optional(),
    repositoryPath: z.string().min(1).max(4096).optional(),
    provider: ProviderIdSchema.optional(),
    roleProviders: z.record(SpecialistRoleSchema, ProviderIdSchema).optional(),
    runStatus: z.enum(["queued", "active", "approval", "paused", "blocked", "failed", "completed"]).optional()
  }).strict()
});
export const ProviderAccountAddSchema = z.object({ provider: ProviderIdSchema, nickname: z.string().min(1).max(80) });
export const ProviderAccountUpdateSchema = z.object({
  profileId: z.string().uuid(), nickname: z.string().min(1).max(80).optional(), enabled: z.boolean().optional(),
  order: z.number().int().min(0).max(100).optional(), allowedProjectIds: z.array(z.string().max(80)).max(100).optional()
});
export const RaDioSettingsMutationSchema = MutationSchema.extend({ settings: RaDioSettingsSchema });
export const RaDioIdeaMutationSchema = MutationSchema.extend({
  ideaId: z.string().uuid(), status: z.enum(["new", "saved", "dismissed", "selected", "running", "promoted"])
});
export const RaDioHandoffSchema = MutationSchema.extend({
  agentId: z.string().min(1).max(120), role: SpecialistRoleSchema, accountId: z.string().uuid(),
  reason: z.enum(["threshold", "quota", "manual", "unavailable"]).optional()
});
export const AuthorizationDecisionSchema = MutationSchema.extend({
  authorizationId: z.string().uuid(),
  decisionToken: z.string().uuid(),
  decision: z.enum(["allow", "deny"]),
  scope: z.enum(["once", "session", "orbit"]),
});
export const AuthorizationRevokeSchema = MutationSchema.extend({
  grantId: z.string().uuid(),
});
export const SkillConfigureSchema = MutationSchema.extend({
  skillId: z.string().regex(/^[a-z0-9][a-z0-9.-]{2,79}$/), enabled: z.boolean(),
  approvedDigest: z.string().regex(/^[a-f0-9]{64}$/).optional()
});
export const SkillCancelSchema = MutationSchema.extend({ executionId: z.string().uuid() });
export const MemoryAddSchema = MutationSchema.extend({
  memoryId: z.string().uuid().optional(),
  entry: z.object({
    scope: z.enum(["orbit", "owner"]), kind: z.enum(["decision", "preference", "convention", "failure", "outcome"]),
    title: z.string().min(1).max(160), value: z.string().min(1).max(4000), confidence: z.number().min(0).max(1)
  })
});
export const MemoryForgetSchema = MutationSchema.extend({ memoryId: z.string().uuid() });
export const TakeoverControlSchema = MutationSchema.extend({ action: z.enum(["start", "pause", "resume", "scan"]) });
export const ChatReferenceSchema = z.object({ kind: z.enum(["coordinate", "incident", "task", "file", "commit", "observation", "star"]), id: z.string().min(1).max(160), label: z.string().min(1).max(240) });
export const ChatSendSchema = MutationSchema.extend({
  body: z.string().min(1).max(20_000), references: z.array(ChatReferenceSchema).max(30),
  attachmentIds: z.array(z.string().uuid()).max(20)
});
export const ChatCancelSchema = MutationSchema.extend({ messageId: z.string().uuid() });
export const MaintenanceMutationSchema = z.object({
  expectedVersion: z.number().int().positive(),
  idempotencyKey: IdempotencyKeySchema
});
export const MaintenanceSendSchema = MaintenanceMutationSchema.extend({
  operationId: z.string().uuid(),
  body: z.string().min(1).max(20_000)
});
export const MaintenanceImprovePromptSchema = z.object({ body: z.string().min(1).max(20_000) });
export const MaintenanceCancelSchema = MaintenanceMutationSchema.extend({ messageId: z.string().uuid() });
export const MaintenanceSourceSchema = MaintenanceMutationSchema.extend({
  operationId: z.string().uuid(),
  source: z.enum(["folder", "orbit"]),
  projectId: z.string().min(4).max(80).optional()
});
export const MaintenanceControlSchema = MaintenanceMutationSchema.extend({ action: z.enum(["run", "pause", "resume", "emergency-stop", "toggle-auto-install"]) });
export const MaintenanceGoalSchema = MaintenanceMutationSchema.extend({ goalId: z.string().uuid(), action: z.enum(["cancel", "retry", "prioritize"]) });
export const MaintenancePanelSchema = MaintenanceMutationSchema.extend({ panel: z.enum(["goals", "activity", "findings", "staging", "automation"]).optional() });
export const HealthSignalSchema = z.object({
  projectId: z.string().min(4).max(80), runId: z.string().min(4).max(80), source: z.string().min(1).max(120),
  operation: z.string().min(1).max(240), message: z.string().min(1).max(4000), severity: z.enum(["info", "warning", "error", "critical"]).optional()
});
export const CloneRepositorySchema = z.object({
  cloneUrl: z.string().url().max(2048),
  projectName: z.string().min(1).max(120),
  storagePath: z.string().min(1).max(4096),
  idempotencyKey: IdempotencyKeySchema
});
export const WorktreeSchema = MutationSchema.extend({
  taskId: z.string().min(1).max(120),
  branch: z.string().min(1).max(120)
});
export const CheckpointSchema = MutationSchema.extend({
  message: z.string().min(1).max(200),
  worktreePath: z.string().min(1).max(4096)
});
export const AddTaskSchema = MutationSchema.extend({
  card: z.object({
    title: z.string().min(1).max(240),
    column: z.enum(["Backlog", "Ready", "Running", "Review", "Blocked", "Done"]),
    provider: ProviderIdSchema,
    meta: z.string().max(300),
    role: SpecialistRoleSchema.optional(),
    requirementIds: z.array(z.string().max(80)).optional(),
    risk: z.enum(["read", "workspace_write", "external_mutation", "destructive"]).optional(),
    attempt: z.number().int().min(1).max(99).optional(),
    dependencies: z.array(z.string().max(120)).optional()
  })
});
export const MoveTaskSchema = MutationSchema.extend({
  taskId: z.string().min(1).max(120),
  column: z.enum(["Backlog", "Ready", "Running", "Review", "Blocked", "Done"])
});
export const PostMessageSchema = MutationSchema.extend({
  message: z.object({
    threadId: z.string().max(120).optional(),
    author: z.string().min(1).max(120),
    role: z.string().min(1).max(120),
    body: z.string().min(1).max(20_000),
    tone: z.enum(["cyan", "violet", "green"]),
    decision: z.boolean().optional(),
    unresolved: z.boolean().optional(),
    replyTo: z.string().max(120).optional()
  })
});
export const PromoteMessageSchema = MutationSchema.extend({ messageId: z.string().min(1).max(120) });
export const AddArtifactSchema = MutationSchema.extend({
  artifact: z.object({
    name: z.string().min(1).max(240),
    type: z.enum(["brief", "design", "architecture", "plan", "patch", "test", "audit", "release", "deployment"]),
    stage: z.string().min(1).max(120),
    size: z.string().max(120),
    status: z.enum(["draft", "review", "approved"])
  })
});
export const ApprovalDecisionSchema = MutationSchema.extend({
  approvalId: z.string().min(1).max(120),
  decision: z.enum(["approved", "denied"]),
  decisionToken: z.string().min(16).max(160).optional()
});
export const ApprovalRequestSchema = MutationSchema.extend({
  title: z.string().min(1).max(240), detail: z.string().min(1).max(4_000),
  risk: z.enum(["read", "workspace_write", "external_mutation", "destructive"]),
  operation: z.string().min(1).max(120), destinationScope: z.string().max(500).optional(),
  diffDigest: z.string().max(256).optional(), credentialScope: z.array(z.string().max(120)).max(20).optional()
});

export const RepositoryNameSchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).max(220);
export const GitHubReadSchema = z.object({ repository: RepositoryNameSchema, page: z.number().int().min(1).max(1000).optional() });
export const GitHubTreeSchema = z.object({
  repository: RepositoryNameSchema,
  ref: z.string().min(1).max(240).regex(/^[A-Za-z0-9._/-]+$/)
});
export const GitHubFileSchema = z.object({
  repository: RepositoryNameSchema,
  sha: z.string().regex(/^[a-fA-F0-9]{40}$/),
  path: z.string().min(1).max(4096)
});
export const GitHubIssueSchema = MutationSchema.extend({
  repository: RepositoryNameSchema, title: z.string().min(1).max(256), body: z.string().max(65_000), approvalId: z.string().min(1).max(120)
});
export const GitHubIssueUpdateSchema = MutationSchema.extend({
  repository: RepositoryNameSchema, issueNumber: z.number().int().positive(), title: z.string().min(1).max(256).optional(),
  body: z.string().max(65_000).optional(), state: z.enum(["open", "closed"]).optional(), approvalId: z.string().min(1).max(120)
});
export const GitHubPullSchema = MutationSchema.extend({
  repository: RepositoryNameSchema, title: z.string().min(1).max(256), body: z.string().max(65_000),
  head: z.string().min(1).max(240), base: z.string().min(1).max(240), draft: z.boolean(), approvalId: z.string().min(1).max(120)
});
export const GitHubPullUpdateSchema = MutationSchema.extend({
  repository: RepositoryNameSchema, pullNumber: z.number().int().positive(), title: z.string().min(1).max(256).optional(),
  body: z.string().max(65_000).optional(), state: z.enum(["open", "closed"]).optional(), base: z.string().min(1).max(240).optional(),
  approvalId: z.string().min(1).max(120)
});
export const GitPushSchema = MutationSchema.extend({
  repositoryPath: z.string().min(1).max(4096), remote: z.string().regex(/^[A-Za-z0-9_.-]+$/).max(120),
  branch: z.string().regex(/^[A-Za-z0-9._/-]+$/).max(240), approvalId: z.string().min(1).max(120)
});
export const GitHubDeleteBranchSchema = MutationSchema.extend({
  repository: RepositoryNameSchema, branch: z.string().regex(/^[A-Za-z0-9._/-]+$/).max(240), approvalId: z.string().min(1).max(120)
});
export const GitHubReviewSchema = MutationSchema.extend({
  repository: RepositoryNameSchema, pullNumber: z.number().int().positive(), body: z.string().max(65_000),
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]), approvalId: z.string().min(1).max(120)
});
export const GitHubMergeSchema = MutationSchema.extend({
  repository: RepositoryNameSchema, pullNumber: z.number().int().positive(), method: z.enum(["merge", "squash", "rebase"]), approvalId: z.string().min(1).max(120)
});
export const NetworkDecisionSchema = z.object({
  requestId: z.string().min(1).max(120), decision: z.enum(["allow", "deny"]),
  scope: z.enum(["once", "project", "permanent"]), projectId: z.string().max(80).optional()
});
export const DeploymentMutationSchema = MutationSchema.extend({ targetId: z.string().min(1).max(120) });
export const DeploymentStartSchema = DeploymentMutationSchema.extend({ approvalId: z.string().min(1).max(120) });
export const DeploymentRollbackSchema = MutationSchema.extend({ deploymentId: z.string().min(1).max(120), approvalId: z.string().min(1).max(120) });
