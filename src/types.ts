export const SCHEMA_VERSION = 1;

export type ProviderId = "codex" | "claude";
export type RaDioMode = "autonomous" | "full_autonomous";
export type AccountHealth = "healthy" | "draining" | "switching" | "cooldown" | "unavailable";
export type RunStatus = "queued" | "active" | "approval" | "paused" | "blocked" | "failed" | "completed";
export type StepStatus = "complete" | "active" | "pending" | "blocked" | "failed" | "skipped";
export type BoardColumn = "Backlog" | "Ready" | "Running" | "Review" | "Blocked" | "Done";
export type RiskClassification = "read" | "workspace_write" | "external_mutation" | "destructive";
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
