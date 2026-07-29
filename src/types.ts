export const SCHEMA_VERSION = 1;

export type ProviderId = "codex" | "claude";
export type RaDioMode = "autonomous" | "full_autonomous";
export type AccountHealth = "healthy" | "draining" | "switching" | "cooldown" | "unavailable";
export type RunStatus = "queued" | "active" | "approval" | "paused" | "blocked" | "failed" | "completed";
export type StepStatus = "complete" | "active" | "pending" | "blocked" | "failed" | "skipped";
export type BoardColumn = "Backlog" | "Ready" | "Running" | "Review" | "Blocked" | "Done";
export type RiskClassification = "read" | "workspace_write" | "external_mutation" | "destructive";
export type SkillSource = "builtin" | "orbit";
export type SkillPermission = "filesystem_read" | "filesystem_write" | "command_execute" | "git_write" | "network_read" | "external_mutation" | "deployment" | "production";
export type SkillCapability = "filesystem" | "command" | "git" | "github" | "provider" | "research" | "browser" | "packages" | "tests" | "deployment" | "observability" | "notifications" | "approvals";
export type SkillHealth = "ready" | "disabled" | "unapproved" | "incompatible" | "running" | "failed";
export type IncidentCategory = "renderer" | "electron" | "provider" | "tool" | "build" | "test" | "git" | "storage" | "security" | "packaging" | "startup" | "unknown";
export type TakeoverPhase = "idle" | "inspecting" | "executing" | "monitoring" | "classifying" | "repairing" | "verifying" | "integrating" | "pushing" | "building" | "installing" | "relaunching" | "observing" | "paused" | "blocked";
export type SpecialistRole =
  | "planner" | "product_designer" | "ui_designer" | "architect"
  | "frontend" | "backend" | "database" | "devops" | "integrator"
  | "reviewer" | "qa" | "security" | "accessibility" | "performance";

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  available: boolean;
  authenticated?: boolean;
  version?: string;
  capabilities?: string[];
}

export interface ProviderContract {
  schemaVersion: 1;
  provider: ProviderId;
  minimumVersion: string;
  detectedVersion?: string;
  compatible: boolean;
  capabilities: string[];
  missingCapabilities: string[];
  remediation?: string;
}

export interface ProviderAuthState {
  provider: ProviderId;
  status: "disconnected" | "authenticating" | "connected" | "expired" | "error";
  profilePath?: string;
  expiresAt?: string;
  login?: string;
  message?: string;
}

export interface UsageSnapshot {
  remainingPercent?: number;
  resetAt?: string;
  source: "provider" | "quota_response" | "local_budget" | "unavailable";
  capturedAt: string;
}

export interface ProviderAccountProfile {
  id: string;
  nickname: string;
  provider: ProviderId;
  login?: string;
  enabled: boolean;
  order: number;
  authenticated: boolean;
  capabilities: string[];
  health: AccountHealth;
  usage: UsageSnapshot;
  activeSessions: number;
  concurrencyLimit: number;
  cooldownUntil?: string;
  failureRate: number;
  allowedProjectIds: string[];
  allowedRoles: SpecialistRole[];
}

export interface AccountPoolPolicy {
  enabled: boolean;
  thresholdPercent: number;
  crossProvider: boolean;
  accountIds: string[];
  rolePins?: Partial<Record<SpecialistRole, string>>;
}

export interface AgentHandoffCheckpoint {
  id: string;
  projectId: string;
  runId: string;
  agentId: string;
  taskId?: string;
  objective: string;
  role: SpecialistRole;
  phase: string;
  filesChanged: string[];
  worktreePath?: string;
  diffDigest?: string;
  completedChecks: string[];
  pendingActions: string[];
  evidenceIds: string[];
  remainingBudget: { minutes: number; tokens: number };
  createdAt: string;
  redacted: true;
}

export interface AccountTransition {
  id: string;
  projectId: string;
  runId: string;
  agentId: string;
  fromAccountId: string;
  toAccountId?: string;
  fromProvider: ProviderId;
  toProvider?: ProviderId;
  reason: "threshold" | "quota" | "manual" | "unavailable";
  status: "checkpointing" | "switching" | "resumed" | "blocked";
  checkpointId?: string;
  createdAt: string;
  completedAt?: string;
}

export type IdeaStatus = "new" | "saved" | "dismissed" | "selected" | "running" | "promoted";
export interface IdeaEvidence { id: string; title: string; source: "project" | "web"; reference: string; summary: string; capturedAt: string }
export interface IdeaProposal {
  id: string;
  projectId: string;
  title: string;
  problem: string;
  opportunity: string;
  persona: string;
  confidence: number;
  impact: "low" | "medium" | "high";
  effort: "small" | "medium" | "large";
  risk: RiskClassification;
  status: IdeaStatus;
  evidence: IdeaEvidence[];
  panelRoles: SpecialistRole[];
  recommendation: string;
  createdAt: string;
}

export interface RaDioReport {
  id: string;
  projectId: string;
  runId: string;
  kind: "final" | "recovery";
  summary: string;
  checks: string[];
  transitions: AccountTransition[];
  risks: string[];
  createdAt: string;
}

export interface SkillManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  description: string;
  source: SkillSource;
  roles: SpecialistRole[];
  coordinates: string[];
  providers: ProviderId[];
  platforms: Array<"linux" | "darwin" | "win32">;
  requiredCapabilities: SkillCapability[];
  requiredAdapters: string[];
  dependencies: string[];
  risk: RiskClassification;
  permissions: SkillPermission[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  preconditions: string[];
  successCriteria: string[];
  validationCommands: string[];
  timeoutSeconds: number;
  maxRetries: number;
  checkpoint: boolean;
  rollback: string;
  redaction: string[];
  evidence: string[];
  integrity: string;
  compatibility: string;
  instructions: string;
}

export interface SkillCompatibility { skillId: string; compatible: boolean; reasons: string[] }
export interface SkillActivation { skillId: string; projectId: string; coordinate: string; role: SpecialistRole; activatedAt: string; automatic: boolean }
export interface SkillEvidence { id: string; executionId: string; kind: "log" | "check" | "artifact" | "screenshot" | "citation" | "waypoint"; title: string; reference: string; redacted: true; createdAt: string }
export interface SkillPolicyDecision { decision: "allow" | "approval" | "deny"; reason: string }
export interface SkillExecution {
  id: string; operationId: string; projectId: string; runId: string; skillId: string; skillVersion: string;
  coordinate: string; role: SpecialistRole; status: "queued" | "running" | "validating" | "succeeded" | "failed" | "cancelled" | "blocked";
  provider?: ProviderId; accountProfileId?: string; startedAt: string; completedAt?: string; attempt: number;
  sessionId?: string;
  policy: SkillPolicyDecision; adapterIds: string[]; evidence: SkillEvidence[]; error?: string;
}
export interface SkillResult { execution: SkillExecution; output: Record<string, unknown>; evidence: SkillEvidence[] }
export interface CapabilityAdapter { id: string; capability: SkillCapability; operations: string[]; available: boolean }
export interface SkillRecord { manifest: SkillManifest; enabled: boolean; approvedDigest?: string; health: SkillHealth; compatibility: SkillCompatibility }
export interface RaDioMemoryEntry {
  id: string; projectId?: string; scope: "orbit" | "owner"; kind: "decision" | "preference" | "convention" | "failure" | "outcome";
  title: string; value: string; confidence: number; createdAt: string; updatedAt: string; expiresAt?: string; redacted: true;
}

export interface HealthSignal {
  id: string; projectId: string; runId: string; source: string; category: IncidentCategory;
  operation: string; message: string; severity: "info" | "warning" | "error" | "critical";
  evidenceDigest: string; capturedAt: string; redacted: true;
}
export interface RepairAttempt { id: string; incidentId: string; attempt: number; role: SpecialistRole; status: "queued" | "running" | "verifying" | "succeeded" | "failed"; worktreePath?: string; checks: string[]; commit?: string; startedAt: string; completedAt?: string }
export interface RepairPlan { incidentId: string; owner: SpecialistRole; verifier: SpecialistRole; skillIds: string[]; summary: string; createdAt: string }
export interface RepairVerification { incidentId: string; verifier: SpecialistRole; passed: boolean; checks: string[]; evidenceIds: string[]; verifiedAt: string }
export interface HealthIncident {
  id: string; fingerprint: string; projectId: string; runId: string; category: IncidentCategory;
  title: string; detail: string; severity: HealthSignal["severity"]; status: "open" | "repairing" | "verifying" | "resolved" | "blocked";
  owner: SpecialistRole; signals: HealthSignal[]; attempts: RepairAttempt[]; plan?: RepairPlan; verification?: RepairVerification;
  createdAt: string; updatedAt: string; resolvedAt?: string;
}
export interface SupervisorCheckpoint { id: string; projectId: string; runId: string; phase: TakeoverPhase; coordinate?: string; incidentId?: string; operationId?: string; stagingRevision?: string; createdAt: string; redacted: true }
export interface StagingPromotion { id: string; projectId: string; runId: string; branch: "staging"; commit: string; remoteCommit?: string; status: "checking" | "integrated" | "pushed" | "blocked"; fastForwardOnly: true; createdAt: string; completedAt?: string; detail: string }
export interface TakeoverState {
  projectId: string; runId: string; enabled: boolean; phase: TakeoverPhase; health: "healthy" | "degraded" | "repairing" | "blocked";
  currentCoordinate?: string; activeIncidentId?: string; installTransactionId?: string; checkpoint?: SupervisorCheckpoint; staging?: StagingPromotion;
  lastHealthScanAt?: string; lastError?: string; updatedAt: string;
}
export interface ReleaseManifest { schemaVersion: 1; version: string; commit: string; sourceDigest: string; artifactDigest: string; checks: string[]; createdAt: string }
export interface CandidateHealthCheck { storage: boolean; providers: boolean; skills: boolean; renderer: boolean; consoleErrors: string[]; heartbeat: boolean; checkedAt: string }
export interface RollbackSnapshot { id: string; version: string; path: string; databaseIncluded: boolean; createdAt: string }
export interface InstallTransaction { id: string; projectId: string; runId: string; version: string; status: "preparing" | "canary" | "activating" | "healthy" | "rolling_back" | "rolled_back" | "failed"; candidatePath: string; previousPath?: string; manifest: ReleaseManifest; health?: CandidateHealthCheck; rollback?: RollbackSnapshot; startedAt: string; completedAt?: string; detail: string }
export interface UserInstallState { currentVersion?: string; previousVersion?: string; currentPath?: string; previousPath?: string; transaction?: InstallTransaction; rollbackReady: boolean }

export interface RaDioChatReference { kind: "coordinate" | "incident" | "task" | "file" | "commit" | "observation" | "star"; id: string; label: string }
export interface RaDioChatAttachment { id: string; name: string; path: string; mime: string; size: number; modifiedAt: string; digest: string; status: "ready" | "stale" | "missing" | "rejected" }
export interface RaDioChatCommand { id: string; kind: "query" | "priority" | "task" | "takeover" | "star" | "health" | "build" | "install" | "staging" | "skill" | "observation"; operation: string; status: "proposed" | "allowed" | "approval" | "denied" | "running" | "completed" | "failed"; policyReason: string }
export interface RaDioExecutionCard { id: string; kind: "tool" | "star" | "approval" | "check" | "waypoint" | "relay" | "staging" | "build" | "install" | "rollback"; title: string; detail: string; status: "queued" | "running" | "completed" | "failed" | "blocked"; createdAt: string; completedAt?: string }
export interface RaDioPanelSummary { roles: SpecialistRole[]; recommendation: string; disagreements: string[]; evidenceIds: string[] }
export interface RaDioChatMessage {
  id: string; projectId: string; runId: string; author: "human" | "radio"; body: string; status: "streaming" | "completed" | "cancelled" | "failed";
  references: RaDioChatReference[]; attachments: RaDioChatAttachment[]; command?: RaDioChatCommand; cards: RaDioExecutionCard[]; panel?: RaDioPanelSummary;
  createdAt: string; completedAt?: string; redacted: true;
}
export interface RaDioChat { id: string; projectId: string; runId: string; archived: boolean; messages: RaDioChatMessage[]; createdAt: string; updatedAt: string }

export interface ApplicationSourceBinding {
  path: string;
  repository: string;
  source: "folder" | "orbit";
  projectId?: string;
  validatedAt: string;
}
export interface MaintenanceMessage {
  id: string;
  author: "human" | "radio";
  body: string;
  operationId: string;
  status: "waiting_for_source" | "streaming" | "completed" | "cancelled" | "failed";
  requiresSource: boolean;
  cards: RaDioExecutionCard[];
  createdAt: string;
  completedAt?: string;
  redacted: true;
}
export interface MaintenanceChat {
  id: string;
  messages: MaintenanceMessage[];
  createdAt: string;
  updatedAt: string;
}
export interface ApplicationMaintenanceSettings {
  version: number;
  provider: ProviderId;
  source?: ApplicationSourceBinding;
  chat: MaintenanceChat;
  pendingOperation?: { operationId: string; body: string; createdAt: string };
  updatedAt: string;
}

export interface RaDioSettings {
  mode: RaDioMode;
  enabled: boolean;
  stagingBranch: string;
  stagingTarget?: string;
  mergeProductionEnabled: boolean;
  productionTarget?: string;
  maxRepairAttempts: number;
  dailyScout: boolean;
  emergencyStopped: boolean;
  accountPool: AccountPoolPolicy;
  skillsEnabled: boolean;
  enabledSkillIds: string[];
  disabledSkillIds: string[];
  approvedOrbitSkillDigests: Record<string, string>;
  memoryEnabled: boolean;
  ownerMemoryEnabled: boolean;
  takeoverEnabled: boolean;
  healthMonitoringEnabled: boolean;
  autoResume: boolean;
  autoPushStaging: boolean;
  autoBuild: boolean;
  autoInstall: boolean;
  installChannel: "user";
  rollbackRetention: 1;
}

export interface WorkflowStep {
  id: string;
  name: string;
  specialist: string;
  role: SpecialistRole;
  status: StepStatus;
  parallelGroup?: string;
  attempt?: number;
  required?: boolean;
}

export interface StarpathAction {
  title: string;
  detail: string;
  milestone: string;
  tool: string;
  elapsed: string;
  specialist?: string;
  estimatedPhase?: string;
}

export interface AgentEvent {
  id: string;
  projectId?: string;
  runId?: string;
  type: "message" | "reasoning" | "tool_start" | "tool_result" | "approval_required" | "artifact" | "usage" | "error" | "completed";
  timestamp: string;
  title: string;
  detail: string;
  specialist?: string;
}

export interface TaskCard {
  id: string;
  projectId?: string;
  title: string;
  column: BoardColumn;
  provider: ProviderId;
  meta: string;
  role?: SpecialistRole;
  requirementIds?: string[];
  risk?: RiskClassification;
  attempt?: number;
  dependencies?: string[];
  worktreePath?: string;
}

export interface ThreadMessage {
  id: string;
  threadId?: string;
  author: string;
  role: string;
  body: string;
  time: string;
  tone: "cyan" | "violet" | "green";
  decision?: boolean;
  unresolved?: boolean;
  replyTo?: string;
}

export interface Artifact {
  id: string;
  projectId: string;
  runId: string;
  name: string;
  type: "brief" | "design" | "architecture" | "plan" | "patch" | "test" | "audit" | "release" | "deployment";
  stage: string;
  createdAt: string;
  size: string;
  status: "draft" | "review" | "approved";
}

export interface Project {
  id: string;
  version: number;
  name: string;
  repository: string;
  repositoryPath?: string;
  objective: string;
  audience?: string;
  constraints?: string;
  visibility: "Private" | "Public" | "Local";
  provider: ProviderId;
  roleProviders?: Partial<Record<SpecialistRole, ProviderId>>;
  runId: string;
  runStatus: RunStatus;
  workflow: WorkflowStep[];
  currentAction: StarpathAction;
  events: AgentEvent[];
  tasks: TaskCard[];
  messages: ThreadMessage[];
  artifacts: Artifact[];
  approvals: ApprovalRequest[];
  radio: RaDioSettings;
  ideas: IdeaProposal[];
  accountTransitions: AccountTransition[];
  radioReports: RaDioReport[];
  skillExecutions: SkillExecution[];
  takeover: TakeoverState;
  incidents: HealthIncident[];
  radioChats: RaDioChat[];
  budget: { minutes: number; usedMinutes: number; tokenLimit: number; usedTokens: number };
  createdAt: string;
  updatedAt: string;
}

export interface TelemetryPolicy {
  enabled: boolean;
  replayEnabled: boolean;
  retentionDays: number;
  quotaBytes: number;
  projectOverrides?: Record<string, Partial<Omit<TelemetryPolicy, "projectOverrides">>>;
}

export type TelemetryKind = "application" | "workflow" | "stage" | "task" | "approval" | "provider" | "tool" | "git" | "test" | "deployment";

export interface TelemetryEvent {
  id: string;
  schemaVersion: number;
  projectId: string;
  runId: string;
  sessionId?: string;
  stage?: string;
  specialist?: string;
  provider?: ProviderId;
  sequence: number;
  monotonicMs: number;
  timestamp: string;
  correlationId: string;
  kind: TelemetryKind;
  name: string;
  outcome?: "started" | "succeeded" | "failed" | "blocked" | "cancelled";
  durationMs?: number;
  payload: Record<string, unknown>;
  redacted: true;
  pinned?: boolean;
}

export interface TelemetrySummary {
  totalEvents: number;
  replayEvents: number;
  storageBytes: number;
  quotaBytes: number;
  retentionDays: number;
  enabled: boolean;
  replayEnabled: boolean;
  cycleMinutes: number;
  approvalWaitMinutes: number;
  reviewRejectionRate: number;
  qaRejectionRate: number;
  providerStats: Array<{ provider: ProviderId; runs: number; successRate: number; avgMinutes: number; cost: number }>;
  stageStats: Array<{ stage: string; minutes: number; attempts: number; outcome: string }>;
}

export interface ReplayBundle {
  runId: string;
  projectId: string;
  pinned: boolean;
  frames: TelemetryEvent[];
}

export interface ApprovalRequest {
  id: string;
  projectId: string;
  runId: string;
  title: string;
  detail: string;
  risk: RiskClassification;
  specialist: string;
  files: string[];
  createdAt: string;
  status: "pending" | "approved" | "denied";
  operation?: string;
  destinationScope?: string;
  diffDigest?: string;
  credentialScope?: string[];
  expiresAt?: string;
  consumedAt?: string;
  decisionToken?: string;
}

export interface GitHubConnection {
  connected: boolean;
  login?: string;
  scopes: string[];
  expiresAt?: string;
  rateLimit?: { remaining: number; limit: number; resetAt: string };
}

export interface GitHubBranch { name: string; sha: string; protected: boolean }
export interface GitHubTreeEntry { path: string; type: "blob" | "tree"; sha: string; size?: number }
export interface GitHubFile { path: string; sha: string; size: number; content: string; encoding: "utf-8" }
export interface GitHubCommit { sha: string; message: string; author?: string; timestamp?: string; url: string }
export interface GitHubIssue { number: number; title: string; state: "open" | "closed"; url: string }
export interface PullRequest { number: number; title: string; state: "open" | "closed"; draft: boolean; url: string; head: string; base: string }
export interface CheckRun { id: number; name: string; status: string; conclusion?: string; url?: string }
export interface Review { id: number; state: string; body: string; author?: string; submittedAt?: string }
export interface MergeResult { merged: boolean; sha?: string; message: string }

export interface NetworkRequest {
  id: string;
  timestamp: string;
  projectId?: string;
  runId?: string;
  process: string;
  workflow?: string;
  url: string;
  host: string;
  protocol: string;
  decision: "allow" | "deny" | "review";
  reason: string;
}

export interface NetworkApproval {
  id: string;
  host: string;
  decision: "allow" | "deny";
  scope: "once" | "project" | "permanent";
  projectId?: string;
  createdAt: string;
  revokedAt?: string;
}

export interface DeploymentTarget {
  id: string;
  name: string;
  adapter: "fixture" | "local-command";
  configured: boolean;
  environment: string;
  smokeUrl?: string;
}

export interface RollbackCheckpoint { id: string; commit: string; createdAt: string; verified: boolean }
export interface DeploymentRun {
  id: string;
  projectId: string;
  runId: string;
  targetId: string;
  status: "preflight" | "approval" | "running" | "verifying" | "succeeded" | "failed" | "rolled_back";
  startedAt: string;
  completedAt?: string;
  checkpoint?: RollbackCheckpoint;
  message: string;
}
export interface HealthFinding { id: string; severity: "info" | "warning" | "error"; area: string; title: string; detail: string; remediation?: string }
export interface ReleaseEvidence { projectId: string; runId: string; cleanWorktree: boolean; testsPassing: boolean; privacyAuditPassing: boolean; requirementsAuditPassing: boolean; releaseApproved: boolean; rollbackReady: boolean; findings: string[] }

export interface PrivacyAudit {
  upstreamCommit: string;
  scannedFiles: number;
  removedFiles: string[];
  findings: number;
  generatedAt: string;
}

export interface IsolationManifest {
  sessionId: string;
  workspaceRoot: string;
  appHome: string;
  providerHome: string;
  worktreePath: string;
  allowedRoots: string[];
}

export interface OnboardingDraft {
  step: number;
  providers: ProviderId[];
  defaultProvider: ProviderId;
  githubConnected: boolean;
  repository: string;
  repositoryPath: string;
  repositoryStoragePath: string;
  projectName: string;
  idea: string;
  audience: string;
  constraints: string;
  roles?: SpecialistRole[];
  radio: RaDioSettings;
  telemetry: TelemetryPolicy;
}

export interface MutationInput {
  projectId: string;
  runId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface AsteriaApi {
  projects: {
    list(): Promise<Project[]>;
    create(draft: OnboardingDraft & { idempotencyKey: string }): Promise<Project>;
    update(input: MutationInput & { patch: Partial<Pick<Project, "name" | "objective" | "repository" | "repositoryPath" | "provider" | "roleProviders" | "runStatus">> }): Promise<Project>;
    subscribe(listener: (project: Project) => void): () => void;
  };
  providers: {
    detect(): Promise<ProviderStatus[]>;
    contracts(): Promise<ProviderContract[]>;
    authState(provider: ProviderId): Promise<ProviderAuthState>;
    authenticate(provider: ProviderId): Promise<{ sessionId: string; pid: number }>;
    start(input: { projectId: string; runId: string; provider: ProviderId; role: SpecialistRole; prompt: string; workspace: string; sessionId: string; profileId?: string }): Promise<{ pid: number }>;
    cancel(sessionId: string): Promise<void>;
  };
  accounts: {
    list(): Promise<ProviderAccountProfile[]>;
    add(input: { provider: ProviderId; nickname: string }): Promise<ProviderAccountProfile>;
    authenticate(profileId: string): Promise<{ sessionId: string; pid: number }>;
    update(input: { profileId: string; nickname?: string; enabled?: boolean; order?: number; allowedProjectIds?: string[] }): Promise<ProviderAccountProfile>;
    remove(profileId: string): Promise<void>;
    refreshUsage(profileId: string): Promise<ProviderAccountProfile>;
  };
  radio: {
    updateSettings(input: MutationInput & { settings: RaDioSettings }): Promise<Project>;
    scout(input: MutationInput): Promise<Project>;
    updateIdea(input: MutationInput & { ideaId: string; status: IdeaStatus }): Promise<Project>;
    safeHandoff(input: MutationInput & { agentId: string; role: SpecialistRole; accountId: string; reason?: "threshold" | "quota" | "manual" | "unavailable" }): Promise<Project>;
    emergencyStop(input: MutationInput): Promise<Project>;
    takeoverStatus(projectId: string): Promise<TakeoverState>;
    takeoverControl(input: MutationInput & { action: "start" | "pause" | "resume" | "scan" }): Promise<Project>;
    incidents(projectId: string): Promise<HealthIncident[]>;
    reportHealth(input: { projectId: string; runId: string; source: string; operation: string; message: string; severity?: HealthSignal["severity"] }): Promise<Project>;
  };
  radioChat: {
    history(projectId: string): Promise<RaDioChat[]>;
    send(input: MutationInput & { body: string; references: RaDioChatReference[]; attachmentIds: string[] }): Promise<Project>;
    cancel(input: MutationInput & { messageId: string }): Promise<Project>;
    selectAttachments(projectId: string): Promise<RaDioChatAttachment[]>;
    validateAttachment(projectId: string, attachmentId: string): Promise<RaDioChatAttachment>;
  };
  maintenance: {
    state(): Promise<ApplicationMaintenanceSettings>;
    send(input: { expectedVersion: number; idempotencyKey: string; operationId: string; body: string }): Promise<ApplicationMaintenanceSettings>;
    cancel(input: { expectedVersion: number; idempotencyKey: string; messageId: string }): Promise<ApplicationMaintenanceSettings>;
    selectSource(input: { expectedVersion: number; idempotencyKey: string; operationId: string; source: "folder" | "orbit"; projectId?: string }): Promise<ApplicationMaintenanceSettings>;
    disconnectSource(input: { expectedVersion: number; idempotencyKey: string }): Promise<ApplicationMaintenanceSettings>;
  };
  installer: {
    state(): Promise<UserInstallState>;
    prepare(input: MutationInput): Promise<UserInstallState>;
    rollback(input: MutationInput): Promise<UserInstallState>;
  };
  skills: {
    list(projectId: string): Promise<SkillRecord[]>;
    inspect(projectId: string, skillId: string): Promise<SkillRecord>;
    configure(input: MutationInput & { skillId: string; enabled: boolean; approvedDigest?: string }): Promise<Project>;
    compatibility(projectId: string, skillId: string): Promise<SkillCompatibility>;
    executions(projectId: string): Promise<SkillExecution[]>;
    cancel(input: MutationInput & { executionId: string }): Promise<Project>;
    memory(projectId: string): Promise<RaDioMemoryEntry[]>;
    remember(input: MutationInput & { memoryId?: string; entry: Pick<RaDioMemoryEntry, "scope" | "kind" | "title" | "value" | "confidence"> }): Promise<RaDioMemoryEntry>;
    forget(input: MutationInput & { memoryId: string }): Promise<void>;
    exportMemory(projectId: string): Promise<string | null>;
  };
  workflows: {
    advance(input: MutationInput & { event: "complete" | "fail_review" | "fail_qa" | "approve" | "pause" | "resume" }): Promise<Project>;
    execute(input: MutationInput): Promise<Project>;
  };
  repositories: {
    clone(input: { cloneUrl: string; projectName: string; storagePath: string; idempotencyKey: string }): Promise<{ path: string }>;
    status(path: string): Promise<{ branch: string; clean: boolean; changedFiles: string[] }>;
    createWorktree(input: MutationInput & { taskId: string; branch: string }): Promise<{ path: string; branch: string }>;
    checkpoint(input: MutationInput & { message: string; worktreePath: string }): Promise<{ commit: string }>;
  };
  boards: {
    add(input: MutationInput & { card: Omit<TaskCard, "id" | "projectId"> }): Promise<Project>;
    move(input: MutationInput & { taskId: string; column: BoardColumn }): Promise<Project>;
  };
  threads: {
    post(input: MutationInput & { message: Omit<ThreadMessage, "id" | "time"> }): Promise<Project>;
    promote(input: MutationInput & { messageId: string }): Promise<Project>;
  };
  artifacts: {
    add(input: MutationInput & { artifact: Omit<Artifact, "id" | "projectId" | "runId" | "createdAt"> }): Promise<Project>;
  };
  approvals: {
    list(projectId: string): Promise<ApprovalRequest[]>;
    request(input: MutationInput & { title: string; detail: string; risk: RiskClassification; operation: string; destinationScope?: string; diffDigest?: string; credentialScope?: string[] }): Promise<Project>;
    decide(input: MutationInput & { approvalId: string; decision: "approved" | "denied"; decisionToken?: string }): Promise<Project>;
  };
  telemetry: {
    policy(): Promise<TelemetryPolicy>;
    updatePolicy(policy: TelemetryPolicy): Promise<TelemetryPolicy>;
    summary(projectId?: string): Promise<TelemetrySummary>;
    replay(projectId: string, runId: string): Promise<ReplayBundle>;
    pin(projectId: string, runId: string, pinned: boolean): Promise<void>;
    clear(projectId?: string): Promise<void>;
    export(projectId?: string): Promise<string | null>;
  };
  privacy: {
    audit(): Promise<PrivacyAudit>;
    isolation(sessionId: string, workspace: string, provider: ProviderId): Promise<IsolationManifest>;
  };
  github: {
    cliStatus(): Promise<{ available: boolean; version?: string; message: string }>;
    authenticateWithCli(): Promise<{ connected: boolean; login: string }>;
    subscribeAuthCode(listener: (payload: { code: string }) => void): () => void;
    beginDeviceFlow(clientId: string): Promise<{ deviceCode: string; userCode: string; verificationUri: string; interval: number }>;
    pollDeviceFlow(input: { clientId: string; deviceCode: string; interval: number }): Promise<{ connected: boolean; login?: string }>;
    repositories(): Promise<Array<{ id: number; fullName: string; private: boolean; cloneUrl: string }>>;
    connection(): Promise<GitHubConnection>;
    branches(repository: string): Promise<GitHubBranch[]>;
    tree(repository: string, ref: string): Promise<GitHubTreeEntry[]>;
    file(repository: string, sha: string, path: string): Promise<GitHubFile>;
    commits(repository: string, ref?: string, page?: number): Promise<GitHubCommit[]>;
    issues(repository: string, page?: number): Promise<GitHubIssue[]>;
    createIssue(input: MutationInput & { repository: string; title: string; body: string; approvalId: string }): Promise<GitHubIssue>;
    updateIssue(input: MutationInput & { repository: string; issueNumber: number; title?: string; body?: string; state?: "open" | "closed"; approvalId: string }): Promise<GitHubIssue>;
    pullRequests(repository: string, page?: number): Promise<PullRequest[]>;
    createPullRequest(input: MutationInput & { repository: string; title: string; body: string; head: string; base: string; draft: boolean; approvalId: string }): Promise<PullRequest>;
    updatePullRequest(input: MutationInput & { repository: string; pullNumber: number; title?: string; body?: string; state?: "open" | "closed"; base?: string; approvalId: string }): Promise<PullRequest>;
    push(input: MutationInput & { repositoryPath: string; remote: string; branch: string; approvalId: string }): Promise<{ output: string }>;
    deleteBranch(input: MutationInput & { repository: string; branch: string; approvalId: string }): Promise<void>;
    checks(repository: string, ref: string): Promise<CheckRun[]>;
    reviews(repository: string, pullNumber: number): Promise<Review[]>;
    review(input: MutationInput & { repository: string; pullNumber: number; body: string; event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"; approvalId: string }): Promise<Review>;
    merge(input: MutationInput & { repository: string; pullNumber: number; method: "merge" | "squash" | "rebase"; approvalId: string }): Promise<MergeResult>;
    disconnect(): Promise<void>;
  };
  networkPolicy: {
    requests(): Promise<NetworkRequest[]>;
    approvals(): Promise<NetworkApproval[]>;
    decide(input: { requestId: string; decision: "allow" | "deny"; scope: "once" | "project" | "permanent"; projectId?: string }): Promise<NetworkApproval>;
    revoke(approvalId: string): Promise<void>;
  };
  deployments: {
    targets(projectId: string): Promise<DeploymentTarget[]>;
    preflight(input: MutationInput & { targetId: string }): Promise<ReleaseEvidence>;
    start(input: MutationInput & { targetId: string; approvalId: string }): Promise<DeploymentRun>;
    status(deploymentId: string): Promise<DeploymentRun>;
    rollback(input: MutationInput & { deploymentId: string; approvalId: string }): Promise<DeploymentRun>;
  };
  diagnostics: {
    export(projectId?: string): Promise<string | null>;
  };
  health: {
    inspect(projectId?: string): Promise<HealthFinding[]>;
  };
  system: {
    openExternal(url: string): Promise<void>;
    selectFolder(): Promise<string | null>;
  };
  events: {
    subscribe(listener: (event: AgentEvent) => void): () => void;
  };
}

declare global {
  interface Window {
    asteria?: AsteriaApi;
  }
}
