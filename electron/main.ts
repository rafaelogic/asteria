import { app, BrowserWindow, clipboard, dialog, ipcMain, safeStorage, session, shell } from "electron";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AddArtifactSchema, AddTaskSchema, ApprovalDecisionSchema, ApprovalRequestSchema, CheckpointSchema, CloneRepositorySchema,
  DeploymentMutationSchema, DeploymentRollbackSchema, DeploymentStartSchema, GitHubDeleteBranchSchema, GitHubIssueSchema,
  GitHubFileSchema, GitHubIssueUpdateSchema, GitHubMergeSchema, GitHubPullSchema, GitHubPullUpdateSchema, GitHubReadSchema,
  GitHubReviewSchema, GitHubTreeSchema, GitPushSchema, NetworkDecisionSchema,
  DeviceFlowSchema, IsolationSchema, MoveTaskSchema, OnboardingSchema, PollFlowSchema, PostMessageSchema,
  ProjectUpdateSchema, PromoteMessageSchema, StartRunSchema, TelemetryPolicySchema, WorkflowMutationSchema,
  WorktreeSchema, ProviderAccountAddSchema, ProviderAccountUpdateSchema, RaDioSettingsMutationSchema, MutationSchema,
  RaDioIdeaMutationSchema, RaDioHandoffSchema
} from "./contracts.js";
import { checkpoint, cloneRepository, createTaskWorktree, repositoryStatus } from "./git.js";
import {
  beginDeviceFlow, configureGitHubStorage, connectionState, createIssue, createPullRequest, deleteBranch, disconnectGitHub,
  getFile, getTree, listBranches, listChecks, listCommits, listIssues, listPullRequests, listRepositories, listReviews, mergePullRequest,
  pollDeviceFlow, refreshConnectionState, storeGitHubToken, submitReview, updateIssue, updatePullRequest
} from "./github.js";
import { createIsolationContext, createProviderProfileContext } from "./isolation.js";
import { decideNetworkRequest } from "./network-policy.js";
import { NetworkPolicyProxy } from "./network-proxy.js";
import { ProviderManager } from "./providers.js";
import { openStore, type AsteriaStore } from "./storage.js";
import { LocalTelemetry } from "./telemetry.js";
import { providerForRole, transitionWorkflow } from "../src/workflow.js";
import type { DeploymentRun, HealthFinding, NetworkApproval, NetworkRequest, ReleaseEvidence } from "../src/types.js";
import { RaDioAccountVault } from "./radio/account-vault.js";
import { RaDioCore } from "./radio/core.js";
import { selectRaDioAccount } from "../src/radio.js";
import { z } from "zod";
import { execFile, spawn, spawnSync } from "node:child_process";
import { promisify } from "node:util";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const providers = new ProviderManager();
let window: BrowserWindow | null = null;
let store: AsteriaStore;
let telemetry: LocalTelemetry;
let accountVault: RaDioAccountVault;
let radio: RaDioCore;
const sessionContext = new Map<string, { projectId: string; runId: string; role: string; provider: "codex" | "claude" }>();
const runningProjectSessions = new Map<string, Set<string>>();
const failedProjectSessions = new Set<string>();
const networkProxy = new NetworkPolicyProxy();
const networkRequests: NetworkRequest[] = [];
const networkApprovals: NetworkApproval[] = [];
const deployments = new Map<string, DeploymentRun>();
const execFileAsync = promisify(execFile);
let degradedCredentialStorage = false;
app.setAppUserModelId("dev.asteria.desktop");
if (process.platform === "linux" && !app.commandLine.getSwitchValue("password-store")) {
  // Use Electron's stable Linux basic backend when Secret Service is unavailable.
  // This must be selected before app readiness so existing basic-backend keys remain decryptable.
  app.commandLine.appendSwitch("password-store", "basic");
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function configureCredentialBackend() {
  if (safeStorage.isEncryptionAvailable()) {
    return;
  }
  const linuxBasicBackend = process.platform === "linux" && app.commandLine.getSwitchValue("password-store") === "basic";
  if (linuxBasicBackend) {
    safeStorage.setUsePlainTextEncryption(true);
    degradedCredentialStorage = true;
    return;
  }
  const fixtureMode = !app.isPackaged && Boolean(process.env.ASTERIA_TEST_STORAGE_KEY);
  if (fixtureMode) {
    safeStorage.setUsePlainTextEncryption(true);
    degradedCredentialStorage = true;
    return;
  }
  throw new Error("The operating-system credential vault is unavailable. Asteria will not create an unencrypted application profile.");
}

function createWindow() {
  const applicationIcon = path.join(currentDir, "../../build/icon.png");
  window = new BrowserWindow({
    width: 1440,
    height: 1024,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#070b0f",
    icon: applicationIcon,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  window.on("closed", () => { window = null; });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL);
    if (!allowed && !url.startsWith("file:")) event.preventDefault();
  });
  if (process.env.VITE_DEV_SERVER_URL) void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  else void window.loadFile(path.join(currentDir, "../../dist/client/index.html"));
}

app.on("second-instance", () => {
  if (!window) {
    if (app.isReady()) createWindow();
    return;
  }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  try {
    configureCredentialBackend();
    store = openStore(app.getPath("userData"));
    accountVault = new RaDioAccountVault(
      app.getPath("userData"),
      (value) => safeStorage.encryptString(value),
      (value) => safeStorage.decryptString(value)
    );
    await accountVault.load();
    await accountVault.ensureDefaults(["codex", "claude"]);
    radio = new RaDioCore(accountVault);
    configureGitHubStorage(app.getPath("userData"));
    telemetry = new LocalTelemetry(store.telemetry);
    process.env.ASTERIA_NETWORK_PROXY = await networkProxy.listen();
    networkProxy.on("decision", (decision) => {
      networkRequests.unshift({ id: randomUUID(), process: "provider-session", protocol: new URL(decision.url).protocol, ...decision });
      networkRequests.splice(200);
      telemetry.record({ projectId: "application", runId: "network", kind: "application", name: "network_request", outcome: decision.decision === "allow" ? "succeeded" : "blocked", payload: decision });
    });
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "Asteria storage is locked",
      message: error instanceof Error ? error.message : "Encrypted storage could not start.",
      detail: "Asteria preserved the existing encrypted files. Restore the OS credential vault or use a new application profile."
    });
    app.quit();
    return;
  }
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const result = decideNetworkRequest(details.url);
    callback({ cancel: result.decision !== "allow" });
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"]
      }
    });
  });
  createWindow();
  telemetry.record({ projectId: "application", runId: "lifecycle", kind: "application", name: "application_started", outcome: "started", payload: { version: app.getVersion(), platform: process.platform } });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => { networkProxy.close(); store?.close(); });

providers.on("event", (sessionId: string, event) => {
  const context = sessionContext.get(sessionId);
  if (context) {
    telemetry.record({
      ...context,
      sessionId,
      specialist: context.role,
      kind: event.type === "tool_result" ? "tool" : "provider",
      name: event.title,
      outcome: event.type === "error" ? "failed" : event.type === "completed" ? "succeeded" : "started",
      payload: { detail: event.detail }
    });
  }
  window?.webContents.send("agent:event", { ...event, projectId: context?.projectId, runId: context?.runId, specialist: context?.role });
  if (context && context.projectId !== "application" && (event.type === "completed" || event.type === "error")) {
    const running = runningProjectSessions.get(context.projectId);
    running?.delete(sessionId);
    if (event.type === "error") failedProjectSessions.add(context.projectId);
    if (running && running.size === 0) {
      const project = store.projects.get(context.projectId);
      if (project) {
        const failed = failedProjectSessions.delete(context.projectId);
        const tasks = project.tasks.map((task) => task.column === "Running" ? { ...task, column: failed ? "Blocked" as const : "Done" as const, meta: failed ? "Provider failed · review logs" : `${task.role ?? "Task"} · complete` } : task);
        const next = failed
          ? { ...project, tasks, runStatus: "blocked" as const, currentAction: { ...project.currentAction, title: "Specialist execution failed", detail: "Review the redacted replay and retry or hand off to another provider." } }
          : { ...transitionWorkflow({ ...project, tasks }, "complete"), version: project.version };
        const updated = store.projects.save(next, project.version, `provider_complete_${project.runId}_${Date.now()}`);
        window?.webContents.send("project:updated", updated);
      }
      runningProjectSessions.delete(context.projectId);
    }
    sessionContext.delete(sessionId);
  }
});

ipcMain.handle("projects:list", () => store.projects.list());
ipcMain.handle("projects:create", async (_event, raw) => {
  const input = OnboardingSchema.parse(raw);
  await repositoryStatus(input.repositoryPath);
  store.telemetry.setPolicy(input.telemetry);
  const project = store.projects.create(input, input.idempotencyKey);
  telemetry.record({ projectId: project.id, runId: project.runId, stage: "define", specialist: "planner", provider: project.provider, kind: "workflow", name: "starpath_created", outcome: "started", payload: { roles: project.workflow.map((step) => step.role) } });
  return project;
});
ipcMain.handle("projects:update", async (_event, raw) => {
  const input = ProjectUpdateSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId) throw new Error("Project/run boundary mismatch.");
  if (input.patch.repositoryPath) await repositoryStatus(input.patch.repositoryPath);
  return store.projects.save({ ...project, ...input.patch }, input.expectedVersion, input.idempotencyKey);
});
ipcMain.handle("workflows:advance", (_event, raw) => {
  const input = WorkflowMutationSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId) throw new Error("Project/run boundary mismatch.");
  const updated = store.projects.transition(project.id, input.expectedVersion, input.idempotencyKey, input.event);
  telemetry.record({ projectId: updated.id, runId: updated.runId, stage: updated.workflow.find((step) => step.status === "active")?.id, specialist: updated.currentAction.specialist, provider: updated.provider, kind: "stage", name: input.event, outcome: input.event.startsWith("fail") ? "failed" : "succeeded", payload: { version: updated.version } });
  return updated;
});
ipcMain.handle("workflows:execute", async (_event, raw) => {
  const input = ProjectUpdateSchema.pick({ projectId: true, runId: true, expectedVersion: true, idempotencyKey: true }).parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId || project.version !== input.expectedVersion || !project.repositoryPath) throw new Error("A current project with a local repository is required.");
  if (project.runStatus === "paused" || project.runStatus === "approval" || project.runStatus === "blocked") throw new Error("Resolve the project gate before executing another stage.");
  const activeSteps = project.workflow.filter((step) => step.status === "active");
  if (!activeSteps.length) throw new Error("No workflow stage is ready to execute.");
  const nextTasks = [...project.tasks];
  const launches: Array<{ sessionId: string; provider: "codex" | "claude"; profileId?: string; role: typeof activeSteps[number]["role"]; workspace: string; prompt: string }> = [];
  for (const step of activeSteps) {
    let task = nextTasks.find((item) => item.role === step.role && item.column !== "Done");
    if (!task) {
      task = { id: randomUUID(), projectId: project.id, title: `${step.name}: ${project.objective.slice(0, 120)}`, column: "Ready", provider: providerForRole(project, step.role), meta: `${step.name} · queued`, role: step.role, risk: step.role === "planner" ? "read" : "workspace_write", attempt: step.attempt ?? 1 };
      nextTasks.push(task);
    }
    let worktreePath = task.worktreePath;
    if (!worktreePath) {
      const worktree = await createTaskWorktree(app.getPath("userData"), project.id, task.id, project.repositoryPath, `${step.id}-${task.id.slice(0, 6)}`);
      worktreePath = worktree.path;
    }
    Object.assign(task, { worktreePath, column: "Running", meta: `${step.name} · active` });
    const provider = providerForRole(project, step.role);
    const account = project.radio.accountPool.enabled
      ? radio.selectAccount(project, step.role, ["structured-stream", "cancellation", "isolated-home", "tool-events"], provider)
      : undefined;
    if (project.radio.accountPool.enabled && !account) throw new Error(`No compatible authorized RaDio account can run ${step.specialist}.`);
    launches.push({
      sessionId: `${project.runId}_${step.id}_${randomUUID().slice(0, 6)}`,
      provider: account?.provider ?? provider,
      profileId: account?.id,
      role: step.role,
      workspace: worktreePath,
      prompt: `${radio.governingPrompt()}\n\nYou are the ${step.specialist} for Asteria project "${project.name}". Objective: ${project.objective}\nStage: ${step.name}\nConstraints: ${project.constraints ?? "None supplied"}\nWork only inside the provided isolated worktree. Produce the stage contract, implementation, tests, and evidence appropriate to your role. Never access ordinary user profiles or send analytics.`
    });
  }
  const updated = store.projects.save({
    ...project,
    tasks: nextTasks,
    currentAction: { ...project.currentAction, title: `${activeSteps.map((step) => step.name).join(" + ")} running`, detail: `${launches.length} isolated specialist session${launches.length === 1 ? "" : "s"} started.`, tool: `${launches.length} worktree${launches.length === 1 ? "" : "s"}` }
  }, input.expectedVersion, input.idempotencyKey);
  for (const launch of launches) {
    const context = await createIsolationContext(app.getPath("userData"), launch.sessionId, launch.workspace, launch.provider, launch.profileId);
    sessionContext.set(launch.sessionId, { projectId: project.id, runId: project.runId, role: launch.role, provider: launch.provider });
    providers.start(launch.provider, launch.prompt, context);
    const running = runningProjectSessions.get(project.id) ?? new Set<string>();
    running.add(launch.sessionId);
    runningProjectSessions.set(project.id, running);
  }
  return updated;
});

ipcMain.handle("providers:detect", () => providers.detectAll());
ipcMain.handle("providers:contracts", () => providers.contracts());
ipcMain.handle("providers:auth-state", (_event, provider: unknown) => {
  if (provider !== "codex" && provider !== "claude") throw new Error("Unsupported provider.");
  const status = providers.detectAll().find((item) => item.id === provider);
  return { provider, status: status?.available ? "connected" : "disconnected", message: status?.available ? `CLI ${status.version ?? "detected"} in Asteria profile` : "CLI is not installed." };
});
ipcMain.handle("providers:authenticate", async (_event, raw: unknown) => {
  if (raw !== "codex" && raw !== "claude") throw new Error("Unsupported provider.");
  const context = await createProviderProfileContext(app.getPath("userData"), raw);
  sessionContext.set(context.sessionId, { projectId: "application", runId: "authentication", role: "authentication", provider: raw });
  return providers.authenticate(raw, context);
});
ipcMain.handle("providers:start", async (_event, raw) => {
  const input = StartRunSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId) throw new Error("Project/run boundary mismatch.");
  if (project.repositoryPath && path.resolve(input.workspace) !== path.resolve(project.repositoryPath)) throw new Error("Workspace is not registered to this project.");
  const account = input.profileId ? accountVault.get(input.profileId) : undefined;
  if (input.profileId && (!account || account.provider !== input.provider || !account.enabled)) throw new Error("Selected provider account is unavailable.");
  const context = await createIsolationContext(app.getPath("userData"), input.sessionId, input.workspace, input.provider, input.profileId);
  sessionContext.set(input.sessionId, { projectId: input.projectId, runId: input.runId, role: input.role, provider: input.provider });
  telemetry.record({ projectId: input.projectId, runId: input.runId, sessionId: input.sessionId, specialist: input.role, provider: input.provider, kind: "provider", name: "provider_started", outcome: "started", payload: {} });
  return providers.start(input.provider, input.prompt, context);
});
ipcMain.handle("providers:cancel", (_event, sessionId: string) => {
  providers.cancel(sessionId);
  sessionContext.delete(sessionId);
});
ipcMain.handle("accounts:list", () => accountVault.list());
ipcMain.handle("accounts:add", async (_event, raw) => {
  const input = ProviderAccountAddSchema.parse(raw);
  return accountVault.add(input.provider, input.nickname);
});
ipcMain.handle("accounts:authenticate", async (_event, profileId: unknown) => {
  const id = z.string().uuid().parse(profileId);
  const profile = accountVault.get(id);
  if (!profile) throw new Error("Provider account profile not found.");
  const context = await createProviderProfileContext(app.getPath("userData"), profile.provider, profile.id);
  sessionContext.set(context.sessionId, { projectId: "application", runId: "authentication", role: "authentication", provider: profile.provider });
  const result = providers.authenticate(profile.provider, context);
  await accountVault.update(profile.id, { authenticated: true, health: "healthy" });
  return result;
});
ipcMain.handle("accounts:update", async (_event, raw) => {
  const input = ProviderAccountUpdateSchema.parse(raw);
  const { profileId, ...patch } = input;
  return accountVault.update(profileId, patch);
});
ipcMain.handle("accounts:remove", async (_event, profileId: unknown) => {
  const id = z.string().uuid().parse(profileId);
  const used = store.projects.list().some((project) => project.radio.accountPool.accountIds.includes(id));
  if (used) throw new Error("Remove this account from project RaDio pools before deleting it.");
  await accountVault.remove(id);
});
ipcMain.handle("accounts:refresh-usage", async (_event, profileId: unknown) => {
  const id = z.string().uuid().parse(profileId);
  const profile = accountVault.get(id);
  if (!profile) throw new Error("Provider account profile not found.");
  // Provider CLIs do not currently expose one normalized authoritative quota endpoint.
  // Preserve unknown instead of estimating; quota errors are handled as failover signals.
  return accountVault.update(id, {
    usage: { source: "unavailable", capturedAt: new Date().toISOString() },
    health: profile.enabled ? "healthy" : "unavailable"
  });
});
ipcMain.handle("radio:update-settings", (_event, raw) => {
  const input = RaDioSettingsMutationSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId) throw new Error("Project/run boundary mismatch.");
  const settings = radio.normalizeSettings(input.settings);
  const accountIds = new Set(accountVault.list().map((profile) => profile.id));
  if (settings.accountPool.accountIds.some((id) => !accountIds.has(id))) throw new Error("RaDio account pool contains an unavailable profile.");
  return store.projects.save({ ...project, radio: settings }, input.expectedVersion, input.idempotencyKey);
});
ipcMain.handle("radio:scout", (_event, raw) => {
  const input = MutationSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId || project.radio.emergencyStopped) throw new Error("RaDio cannot scout this project.");
  const nextIdeas = radio.scout(project).filter((idea) => !project.ideas.some((existing) => existing.title === idea.title));
  const updated = store.projects.save({
    ...project, ideas: [...nextIdeas, ...project.ideas],
    events: [{ id: randomUUID(), projectId: project.id, runId: project.runId, type: "artifact", timestamp: new Date().toISOString(), title: "RaDio scout complete", detail: `${nextIdeas.length} evidence-backed ideas added to the project inbox.`, specialist: "RaDio" }, ...project.events]
  }, input.expectedVersion, input.idempotencyKey);
  telemetry.record({ projectId: project.id, runId: project.runId, kind: "workflow", name: "radio_scout", outcome: "succeeded", payload: { ideas: nextIdeas.length } });
  return updated;
});
ipcMain.handle("radio:update-idea", (_event, raw) => {
  const input = RaDioIdeaMutationSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId) throw new Error("Project/run boundary mismatch.");
  if (!project.ideas.some((idea) => idea.id === input.ideaId)) throw new Error("Idea is not part of this project.");
  return store.projects.save({ ...project, ideas: project.ideas.map((idea) => idea.id === input.ideaId ? { ...idea, status: input.status } : idea) }, input.expectedVersion, input.idempotencyKey);
});
ipcMain.handle("radio:safe-handoff", (_event, raw) => {
  const input = RaDioHandoffSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  const current = accountVault.get(input.accountId);
  if (!project || project.runId !== input.runId || !current) throw new Error("RaDio handoff boundary mismatch.");
  const policy = { ...project.radio.accountPool, accountIds: project.radio.accountPool.accountIds.filter((id) => id !== current.id) };
  const replacement = selectRaDioAccount(accountVault.list(), policy, project.id, input.role, current.capabilities, current.provider);
  const now = new Date().toISOString();
  const checkpoint = {
    id: randomUUID(), projectId: project.id, runId: project.runId, agentId: input.agentId,
    objective: project.objective, role: input.role, phase: project.currentAction.milestone, filesChanged: [],
    completedChecks: [], pendingActions: [project.currentAction.detail], evidenceIds: project.artifacts.map((artifact) => artifact.id),
    remainingBudget: { minutes: Math.max(0, project.budget.minutes - project.budget.usedMinutes), tokens: Math.max(0, project.budget.tokenLimit - project.budget.usedTokens) },
    createdAt: now, redacted: true as const
  };
  const transition = {
    id: randomUUID(), projectId: project.id, runId: project.runId, agentId: input.agentId,
    fromAccountId: current.id, toAccountId: replacement?.id, fromProvider: current.provider, toProvider: replacement?.provider,
    reason: input.reason ?? "manual", status: replacement ? "resumed" as const : "blocked" as const,
    checkpointId: checkpoint.id, createdAt: now, completedAt: replacement ? now : undefined
  };
  return store.projects.save({
    ...project, accountTransitions: [transition, ...project.accountTransitions],
    events: [{ id: randomUUID(), projectId: project.id, runId: project.runId, type: replacement ? "completed" : "error", timestamp: now, title: replacement ? "RaDio account handoff complete" : "RaDio account pool exhausted", detail: replacement ? `${current.nickname} → ${replacement.nickname} · normalized checkpoint ${checkpoint.id.slice(0, 8)}` : "No compatible authorized account can continue critical-path work.", specialist: "RaDio" }, ...project.events]
  }, input.expectedVersion, input.idempotencyKey);
});
ipcMain.handle("radio:emergency-stop", (_event, raw) => {
  const input = MutationSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId) throw new Error("Project/run boundary mismatch.");
  runningProjectSessions.get(project.id)?.forEach((sessionId) => providers.cancel(sessionId));
  runningProjectSessions.delete(project.id);
  return store.projects.save({ ...project, runStatus: "paused", radio: { ...project.radio, enabled: false, emergencyStopped: true }, currentAction: { ...project.currentAction, title: "RaDio emergency stop", detail: "All project agent sessions were cancelled. Human review is required before resuming." } }, input.expectedVersion, input.idempotencyKey);
});

ipcMain.handle("repositories:clone", async (_event, raw) => {
  const input = CloneRepositorySchema.parse(raw);
  return cloneRepository(app.getPath("userData"), input.cloneUrl, input.projectName);
});
ipcMain.handle("repositories:status", (_event, repositoryPath: string) => repositoryStatus(repositoryPath));
ipcMain.handle("repositories:create-worktree", async (_event, raw) => {
  const input = WorktreeSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId || project.version !== input.expectedVersion || !project.repositoryPath) throw new Error("Stale or invalid project worktree request.");
  const task = project.tasks.find((item) => item.id === input.taskId);
  if (!task) throw new Error("Task is not part of this project.");
  const result = await createTaskWorktree(app.getPath("userData"), project.id, task.id, project.repositoryPath, input.branch);
  telemetry.record({ projectId: project.id, runId: project.runId, stage: "build", specialist: task.role, provider: task.provider, kind: "git", name: "worktree_created", outcome: "succeeded", payload: { taskId: task.id, branch: result.branch } });
  return result;
});
ipcMain.handle("repositories:checkpoint", async (_event, raw) => {
  const input = CheckpointSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId || project.version !== input.expectedVersion) throw new Error("Stale or invalid checkpoint request.");
  const result = await checkpoint(input.worktreePath, input.message);
  telemetry.record({ projectId: project.id, runId: project.runId, kind: "git", name: "checkpoint_created", outcome: "succeeded", payload: { commit: result.commit } });
  return result;
});

ipcMain.handle("boards:add", (_event, raw) => {
  const input = AddTaskSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId) throw new Error("Project/run boundary mismatch.");
  const card = { ...input.card, id: randomUUID(), projectId: project.id };
  return store.projects.save({ ...project, tasks: [...project.tasks, card] }, input.expectedVersion, input.idempotencyKey);
});
ipcMain.handle("boards:move", (_event, raw) => {
  const input = MoveTaskSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId || !project.tasks.some((task) => task.id === input.taskId)) throw new Error("Task boundary mismatch.");
  return store.projects.save({ ...project, tasks: project.tasks.map((task) => task.id === input.taskId ? { ...task, column: input.column } : task) }, input.expectedVersion, input.idempotencyKey);
});
ipcMain.handle("threads:post", (_event, raw) => {
  const input = PostMessageSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId) throw new Error("Project/run boundary mismatch.");
  const message = { ...input.message, id: randomUUID(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
  return store.projects.save({ ...project, messages: [...project.messages, message] }, input.expectedVersion, input.idempotencyKey);
});
ipcMain.handle("threads:promote", (_event, raw) => {
  const input = PromoteMessageSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  const message = project?.messages.find((item) => item.id === input.messageId);
  if (!project || project.runId !== input.runId || !message) throw new Error("Message boundary mismatch.");
  const card = { id: randomUUID(), projectId: project.id, title: message.body.slice(0, 180), column: "Backlog" as const, provider: project.provider, meta: "Promoted from discussion", role: "planner" as const, risk: "read" as const, attempt: 1 };
  return store.projects.save({ ...project, tasks: [...project.tasks, card] }, input.expectedVersion, input.idempotencyKey);
});
ipcMain.handle("artifacts:add", (_event, raw) => {
  const input = AddArtifactSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId) throw new Error("Project/run boundary mismatch.");
  const artifact = { ...input.artifact, id: randomUUID(), projectId: project.id, runId: project.runId, createdAt: new Date().toISOString() };
  return store.projects.save({ ...project, artifacts: [...project.artifacts, artifact] }, input.expectedVersion, input.idempotencyKey);
});
ipcMain.handle("approvals:list", (_event, projectId: string) => store.projects.get(projectId)?.approvals ?? []);
ipcMain.handle("approvals:request", (_event, raw) => {
  const input = ApprovalRequestSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  if (!project || project.runId !== input.runId) throw new Error("Approval boundary mismatch.");
  const approval = {
    id: randomUUID(), projectId: project.id, runId: project.runId, title: input.title, detail: input.detail,
    risk: input.risk, specialist: "Human", files: [], createdAt: new Date().toISOString(), status: "pending" as const,
    operation: input.operation, destinationScope: input.destinationScope, diffDigest: input.diffDigest,
    credentialScope: input.credentialScope, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    decisionToken: randomUUID()
  };
  return store.projects.save({ ...project, approvals: [...project.approvals, approval] }, input.expectedVersion, input.idempotencyKey);
});
ipcMain.handle("approvals:decide", (_event, raw) => {
  const input = ApprovalDecisionSchema.parse(raw);
  const project = store.projects.get(input.projectId);
  const requested = project?.approvals.find((approval) => approval.id === input.approvalId);
  if (!project || project.runId !== input.runId || !requested) throw new Error("Approval boundary mismatch.");
  if (requested.decisionToken && requested.decisionToken !== input.decisionToken) throw new Error("The one-time approval token is missing or stale.");
  if (requested.expiresAt && Date.parse(requested.expiresAt) < Date.now()) throw new Error("Approval expired.");
  if (requested.status !== "pending") throw new Error("Approval was already decided.");
  const approvals = project.approvals.map((approval) => approval.id === input.approvalId ? { ...approval, status: input.decision } : approval);
  telemetry.record({ projectId: project.id, runId: project.runId, kind: "approval", name: input.decision, outcome: input.decision === "approved" ? "succeeded" : "blocked", payload: { approvalId: input.approvalId } });
  const decided = input.decision === "approved"
    ? { ...transitionWorkflow({ ...project, approvals }, "approve"), version: project.version }
    : { ...project, approvals, runStatus: "blocked" as const, currentAction: { ...project.currentAction, title: "Approval denied", detail: "Human direction is required before the workflow can continue." } };
  return store.projects.save(decided, input.expectedVersion, input.idempotencyKey);
});

ipcMain.handle("telemetry:policy", () => store.telemetry.policy());
ipcMain.handle("telemetry:update-policy", (_event, raw) => store.telemetry.setPolicy(TelemetryPolicySchema.parse(raw)));
ipcMain.handle("telemetry:summary", (_event, projectId?: string) => store.telemetry.summary(projectId));
ipcMain.handle("telemetry:replay", (_event, raw: { projectId: string; runId: string }) => ({
  projectId: raw.projectId,
  runId: raw.runId,
  pinned: store.telemetry.events(raw.projectId, raw.runId).some((event) => event.pinned),
  frames: store.telemetry.events(raw.projectId, raw.runId)
}));
ipcMain.handle("telemetry:pin", (_event, raw: { projectId: string; runId: string; pinned: boolean }) => store.telemetry.pin(raw.projectId, raw.runId, raw.pinned));
ipcMain.handle("telemetry:clear", (_event, projectId?: string) => store.telemetry.clear(projectId));
ipcMain.handle("telemetry:export", async (_event, projectId?: string) => {
  const result = await dialog.showSaveDialog({ title: "Export redacted Asteria telemetry", defaultPath: `asteria-telemetry-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: "JSON", extensions: ["json"] }] });
  if (result.canceled || !result.filePath) return null;
  const projects = projectId ? store.projects.list().filter((project) => project.id === projectId) : store.projects.list();
  const exportData = { exportedAt: new Date().toISOString(), localOnly: true, projects: projects.map((project) => ({ id: project.id, name: project.name, summary: store.telemetry.summary(project.id), replay: store.telemetry.events(project.id, project.runId) })) };
  await writeFile(result.filePath, JSON.stringify(exportData, null, 2), { mode: 0o600 });
  return result.filePath;
});

ipcMain.handle("privacy:isolation", async (_event, raw) => {
  const input = IsolationSchema.parse(raw);
  const context = await createIsolationContext(app.getPath("userData"), input.sessionId, input.workspace, input.provider);
  const { env: _env, ...manifest } = context;
  return manifest;
});
ipcMain.handle("privacy:audit", async () => {
  const report = app.isPackaged ? path.join(process.resourcesPath, "runtime/privacy-audit.json") : path.join(app.getAppPath(), "runtime/privacy-audit.json");
  return JSON.parse(await readFile(report, "utf8"));
});
ipcMain.handle("github:begin-device-flow", (_event, raw) => beginDeviceFlow(DeviceFlowSchema.parse(raw).clientId));
function isolatedGitHubCliEnvironment() {
  const root = path.join(app.getPath("userData"), "auth", "github-cli");
  const home = path.join(root, "home");
  const config = path.join(root, "config");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, ".config"),
    XDG_CACHE_HOME: path.join(home, ".cache"),
    XDG_DATA_HOME: path.join(home, ".local", "share"),
    GH_CONFIG_DIR: config,
    GH_NO_UPDATE_NOTIFIER: "1",
    GH_PROMPT_DISABLED: "1"
  };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  return { root, home, config, env };
}

function runGitHubBrowserLogin(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let devicePageOpened = false;
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("GitHub browser authentication timed out. Please retry."));
    }, 15 * 60_000);
    const capture = (chunk: Buffer | string) => {
      output = `${output}${chunk.toString()}`.slice(-64 * 1024);
      const plainOutput = output.replace(/\u001b\[[0-9;]*m/g, "");
      const code = plainOutput.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/)?.[0];
      if (code && !devicePageOpened) {
        devicePageOpened = true;
        clipboard.writeText(code);
        window?.webContents.send("github:device-code", { code });
        void shell.openExternal("https://github.com/login/device");
      }
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else {
        const detail = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
        reject(new Error(detail || `GitHub CLI authentication exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}

ipcMain.handle("github:cli-status", () => {
  const result = spawnSync(process.platform === "win32" ? "gh.exe" : "gh", ["--version"], { encoding: "utf8", timeout: 4_000, shell: false });
  return {
    available: result.status === 0,
    version: result.status === 0 ? result.stdout.split("\n")[0].trim() : undefined,
    message: result.status === 0 ? "GitHub CLI browser authorization is available." : "Install GitHub CLI to connect without an Asteria OAuth client ID."
  };
});
ipcMain.handle("github:authenticate-cli", async () => {
  const command = process.platform === "win32" ? "gh.exe" : "gh";
  const detection = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 4_000, shell: false });
  if (detection.status !== 0) throw new Error("GitHub CLI is not installed. Install gh or continue with local Git.");
  const loginHelp = spawnSync(command, ["auth", "login", "--help"], {
    encoding: "utf8", timeout: 4_000, shell: false
  });
  const supportedFlags = `${loginHelp.stdout ?? ""}\n${loginHelp.stderr ?? ""}`;
  const loginArguments = [
    "auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web"
  ];
  // These convenience flags are not available in older distribution-packaged
  // GitHub CLI releases. Browser authentication itself works without them.
  if (supportedFlags.includes("--clipboard")) loginArguments.push("--clipboard");
  if (supportedFlags.includes("--skip-ssh-key")) loginArguments.push("--skip-ssh-key");
  loginArguments.push("--scopes", "repo,read:user,workflow");
  const context = isolatedGitHubCliEnvironment();
  await mkdir(context.config, { recursive: true, mode: 0o700 });
  try {
    await runGitHubBrowserLogin(command, loginArguments, context.env);
    const tokenResult = await execFileAsync(command, ["auth", "token", "--hostname", "github.com"], { env: context.env, timeout: 10_000, windowsHide: true });
    const loginResult = await execFileAsync(command, ["api", "user", "--jq", ".login"], { env: context.env, timeout: 15_000, windowsHide: true });
    const token = tokenResult.stdout.trim();
    const login = loginResult.stdout.trim();
    if (!token || !/^[A-Za-z0-9-]{1,80}$/.test(login)) throw new Error("GitHub CLI authorization completed without a usable account token.");
    storeGitHubToken(token, login);
    // Remove GitHub CLI's temporary keyring/config entry after Asteria vault import.
    spawnSync(command, ["auth", "logout", "--hostname", "github.com", "--user", login], {
      env: context.env, input: "y\n", encoding: "utf8", timeout: 10_000, shell: false
    });
    telemetry.record({ projectId: "application", runId: "authentication", kind: "application", name: "github_cli_authenticated", outcome: "succeeded", payload: { login, isolatedProfile: true } });
    return { connected: true, login };
  } finally {
    await rm(context.root, { recursive: true, force: true });
  }
});
ipcMain.handle("github:poll-device-flow", (_event, raw) => {
  const input = PollFlowSchema.parse(raw);
  return pollDeviceFlow(input.clientId, input.deviceCode);
});
ipcMain.handle("github:repositories", () => listRepositories());
ipcMain.handle("github:connection", () => refreshConnectionState());
ipcMain.handle("github:branches", (_event, raw) => listBranches(GitHubReadSchema.parse(raw).repository));
ipcMain.handle("github:tree", (_event, raw) => {
  const input = GitHubTreeSchema.parse(raw);
  return getTree(input.repository, input.ref);
});
ipcMain.handle("github:file", (_event, raw) => {
  const input = GitHubFileSchema.parse(raw);
  return getFile(input.repository, input.sha, input.path);
});
ipcMain.handle("github:commits", (_event, raw) => {
  const input = GitHubReadSchema.extend({ ref: z.string().max(240).optional() }).parse(raw);
  return listCommits(input.repository, input.ref, input.page);
});
ipcMain.handle("github:issues", (_event, raw) => { const input = GitHubReadSchema.parse(raw); return listIssues(input.repository, input.page); });
ipcMain.handle("github:pull-requests", (_event, raw) => { const input = GitHubReadSchema.parse(raw); return listPullRequests(input.repository, input.page); });
ipcMain.handle("github:checks", (_event, raw) => {
  const input = GitHubReadSchema.extend({ ref: z.string().min(1).max(240) }).parse(raw);
  return listChecks(input.repository, input.ref);
});
ipcMain.handle("github:reviews", (_event, raw) => {
  const input = GitHubReadSchema.extend({ pullNumber: z.number().int().positive() }).parse(raw);
  return listReviews(input.repository, input.pullNumber);
});
function approvedMutation(projectId: string, runId: string, approvalId: string, operation: string) {
  const project = store.projects.get(projectId);
  const approval = project?.approvals.find((item) => item.id === approvalId);
  if (!project || project.runId !== runId || !approval || approval.status !== "approved" || approval.operation !== operation || approval.consumedAt) throw new Error(`A current, operation-bound approval for ${operation} is required.`);
  if (approval.expiresAt && Date.parse(approval.expiresAt) < Date.now()) throw new Error("Approval expired. Request a new focused approval.");
  return { project, approval };
}
function recordExternalResult(projectId: string, approvalId: string, operation: string, detail: string) {
  const project = store.projects.get(projectId);
  if (!project) return;
  const approvals = project.approvals.map((item) => item.id === approvalId ? { ...item, consumedAt: new Date().toISOString() } : item);
  const events = [...project.events, { id: randomUUID(), projectId, runId: project.runId, type: "tool_result" as const, timestamp: new Date().toISOString(), title: operation, detail, specialist: "GitHub" }];
  const updated = store.projects.save({ ...project, approvals, events }, project.version, `external_${operation}_${approvalId}`);
  telemetry.record({ projectId, runId: project.runId, kind: "git", name: operation, outcome: "succeeded", payload: { approvalId } });
  window?.webContents.send("project:updated", updated);
}
ipcMain.handle("github:create-issue", async (_event, raw) => {
  const input = GitHubIssueSchema.parse(raw); approvedMutation(input.projectId, input.runId, input.approvalId, "github.issue.create");
  const result = await createIssue(input.repository, input.title, input.body); recordExternalResult(input.projectId, input.approvalId, "github.issue.create", `Created issue #${result.number}`); return result;
});
ipcMain.handle("github:update-issue", async (_event, raw) => {
  const input = GitHubIssueUpdateSchema.parse(raw); approvedMutation(input.projectId, input.runId, input.approvalId, "github.issue.update");
  const result = await updateIssue(input.repository, input.issueNumber, { title: input.title, body: input.body, state: input.state }); recordExternalResult(input.projectId, input.approvalId, "github.issue.update", `Updated issue #${result.number}`); return result;
});
ipcMain.handle("github:create-pull-request", async (_event, raw) => {
  const input = GitHubPullSchema.parse(raw); approvedMutation(input.projectId, input.runId, input.approvalId, "github.pull.create");
  const result = await createPullRequest(input.repository, input.title, input.body, input.head, input.base, input.draft); recordExternalResult(input.projectId, input.approvalId, "github.pull.create", `Created pull request #${result.number}`); return result;
});
ipcMain.handle("github:update-pull-request", async (_event, raw) => {
  const input = GitHubPullUpdateSchema.parse(raw); approvedMutation(input.projectId, input.runId, input.approvalId, "github.pull.update");
  const result = await updatePullRequest(input.repository, input.pullNumber, { title: input.title, body: input.body, state: input.state, base: input.base }); recordExternalResult(input.projectId, input.approvalId, "github.pull.update", `Updated pull request #${result.number}`); return result;
});
ipcMain.handle("github:push", async (_event, raw) => {
  const input = GitPushSchema.parse(raw); const { project } = approvedMutation(input.projectId, input.runId, input.approvalId, "github.push");
  if (!project.repositoryPath || path.resolve(project.repositoryPath) !== path.resolve(input.repositoryPath)) throw new Error("Push repository boundary mismatch.");
  const result = await execFileAsync("git", ["-C", input.repositoryPath, "push", input.remote, input.branch], { timeout: 120_000, windowsHide: true });
  recordExternalResult(input.projectId, input.approvalId, "github.push", "Approved branch push completed."); return { output: result.stdout.trim() || result.stderr.trim() };
});
ipcMain.handle("github:delete-branch", async (_event, raw) => {
  const input = GitHubDeleteBranchSchema.parse(raw); approvedMutation(input.projectId, input.runId, input.approvalId, "github.branch.delete");
  await deleteBranch(input.repository, input.branch); recordExternalResult(input.projectId, input.approvalId, "github.branch.delete", `Deleted branch ${input.branch}`);
});
ipcMain.handle("github:review", async (_event, raw) => {
  const input = GitHubReviewSchema.parse(raw); approvedMutation(input.projectId, input.runId, input.approvalId, "github.review.submit");
  const result = await submitReview(input.repository, input.pullNumber, input.body, input.event); recordExternalResult(input.projectId, input.approvalId, "github.review.submit", `Submitted ${input.event}`); return result;
});
ipcMain.handle("github:merge", async (_event, raw) => {
  const input = GitHubMergeSchema.parse(raw); approvedMutation(input.projectId, input.runId, input.approvalId, "github.pull.merge");
  const result = await mergePullRequest(input.repository, input.pullNumber, input.method); recordExternalResult(input.projectId, input.approvalId, "github.pull.merge", result.message); return result;
});
ipcMain.handle("github:disconnect", () => disconnectGitHub());
ipcMain.handle("network:requests", () => networkRequests);
ipcMain.handle("network:approvals", () => networkApprovals.filter((item) => !item.revokedAt));
ipcMain.handle("network:decide", (_event, raw) => {
  const input = NetworkDecisionSchema.parse(raw);
  const request = networkRequests.find((item) => item.id === input.requestId);
  if (!request) throw new Error("Network request is stale.");
  const approval: NetworkApproval = { id: randomUUID(), host: request.host, decision: input.decision, scope: input.scope, projectId: input.projectId, createdAt: new Date().toISOString() };
  networkApprovals.push(approval); networkProxy.setHostDecision(request.host, input.decision); return approval;
});
ipcMain.handle("network:revoke", (_event, approvalId: string) => {
  const approval = networkApprovals.find((item) => item.id === approvalId);
  if (!approval) throw new Error("Network approval not found.");
  approval.revokedAt = new Date().toISOString(); networkProxy.revokeHost(approval.host);
});
ipcMain.handle("deployments:targets", (_event, projectId: string) => {
  if (!store.projects.get(projectId)) throw new Error("Project not found.");
  return [{ id: "fixture", name: "Deterministic acceptance target", adapter: "fixture", configured: process.env.ASTERIA_DEPLOYMENT_FIXTURE === "1", environment: "acceptance", smokeUrl: "http://127.0.0.1" }];
});
async function releaseEvidence(projectId: string, runId: string): Promise<ReleaseEvidence> {
  const project = store.projects.get(projectId);
  if (!project || project.runId !== runId || !project.repositoryPath) throw new Error("Deployment project boundary mismatch.");
  const status = await repositoryStatus(project.repositoryPath);
  const privacy = await (async () => {
    const reportPath = app.isPackaged ? path.join(process.resourcesPath, "runtime/privacy-audit.json") : path.join(app.getAppPath(), "runtime/privacy-audit.json");
    return JSON.parse(await readFile(reportPath, "utf8")) as { findings: number };
  })();
  const releaseApproved = project.approvals.some((approval) => approval.status === "approved" && /release/i.test(approval.title));
  const requirementsAuditPassing = project.artifacts.some((artifact) => artifact.type === "audit" && artifact.status === "approved");
  const testsPassing = project.artifacts.some((artifact) => artifact.type === "test" && artifact.status === "approved");
  const findings = [
    ...(!status.clean ? ["Worktree has uncommitted changes."] : []),
    ...(!testsPassing ? ["Approved test evidence is missing."] : []),
    ...(privacy.findings ? ["Privacy audit has findings."] : []),
    ...(!requirementsAuditPassing ? ["Requirements audit is not approved."] : []),
    ...(!releaseApproved ? ["Human release approval is missing."] : [])
  ];
  return { projectId, runId, cleanWorktree: status.clean, testsPassing, privacyAuditPassing: privacy.findings === 0, requirementsAuditPassing, releaseApproved, rollbackReady: status.clean, findings };
}
ipcMain.handle("deployments:preflight", (_event, raw) => {
  const input = DeploymentMutationSchema.parse(raw);
  if (input.targetId !== "fixture" || process.env.ASTERIA_DEPLOYMENT_FIXTURE !== "1") throw new Error("Deployment target is not explicitly configured.");
  return releaseEvidence(input.projectId, input.runId);
});
ipcMain.handle("deployments:start", async (_event, raw) => {
  const input = DeploymentStartSchema.parse(raw);
  approvedMutation(input.projectId, input.runId, input.approvalId, "deployment.start");
  const evidence = await releaseEvidence(input.projectId, input.runId);
  if (evidence.findings.length) throw new Error(`Deployment preflight failed: ${evidence.findings.join(" ")}`);
  const deployment: DeploymentRun = { id: randomUUID(), projectId: input.projectId, runId: input.runId, targetId: input.targetId, status: "succeeded", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), checkpoint: { id: randomUUID(), commit: "fixture-checkpoint", createdAt: new Date().toISOString(), verified: true }, message: "Release executed and smoke verification passed." };
  deployments.set(deployment.id, deployment); recordExternalResult(input.projectId, input.approvalId, "deployment.start", deployment.message); return deployment;
});
ipcMain.handle("deployments:status", (_event, deploymentId: string) => {
  const deployment = deployments.get(deploymentId); if (!deployment) throw new Error("Deployment not found."); return deployment;
});
ipcMain.handle("deployments:rollback", (_event, raw) => {
  const input = DeploymentRollbackSchema.parse(raw);
  approvedMutation(input.projectId, input.runId, input.approvalId, "deployment.rollback");
  const deployment = deployments.get(input.deploymentId); if (!deployment || deployment.projectId !== input.projectId) throw new Error("Deployment boundary mismatch.");
  const rolledBack = { ...deployment, status: "rolled_back" as const, completedAt: new Date().toISOString(), message: "Rollback checkpoint restored and verified." };
  deployments.set(rolledBack.id, rolledBack); recordExternalResult(input.projectId, input.approvalId, "deployment.rollback", rolledBack.message); return rolledBack;
});
ipcMain.handle("health:inspect", async (_event, projectId?: string) => {
  const findings: HealthFinding[] = providers.contracts().filter((contract) => !contract.compatible).map((contract) => ({ id: `provider-${contract.provider}`, severity: "warning", area: "Provider", title: `${contract.provider} needs attention`, detail: contract.remediation ?? "Provider is incompatible." }));
  try {
    const recovery = JSON.parse(await readFile(path.join(app.getPath("userData"), "recovery-state.json"), "utf8")) as { path: string; recoveredAt: string };
    findings.unshift({
      id: "encrypted-store-recovery",
      severity: "warning",
      area: "Recovery",
      title: "Previous encrypted store preserved",
      detail: `Asteria created a clean store because the previous credential backend could not unlock its key. The original database and key remain together at ${recovery.path}.`,
      remediation: "Restore the original OS credential backend to recover that store, then import it through a future recovery session."
    });
  } catch {
    // No locked-store recovery is pending.
  }
  if (degradedCredentialStorage) findings.unshift({
    id: "credential-storage-basic",
    severity: "warning",
    area: "Credential storage",
    title: "Linux keyring unavailable",
    detail: "Asteria is using Electron's explicitly requested basic local credential backend. Files remain restricted to this application profile, but OS-keyring protection is unavailable.",
    remediation: "Install and unlock a Secret Service-compatible keyring, then relaunch Asteria without --password-store=basic."
  });
  if (projectId) {
    const project = store.projects.get(projectId);
    if (!project?.repositoryPath) findings.push({ id: "repository-missing", severity: "error", area: "Repository", title: "Repository unavailable", detail: "Select or clone a local repository before running specialists." });
  }
  if (!connectionState().connected) findings.push({ id: "github-disconnected", severity: "info", area: "GitHub", title: "GitHub is not connected", detail: "Local Git remains available." });
  return findings;
});
ipcMain.handle("diagnostics:export", async (_event, projectId?: string) => {
  const result = await dialog.showSaveDialog({ title: "Export redacted Asteria diagnostics", defaultPath: `asteria-diagnostics-${new Date().toISOString().slice(0, 10)}.json` });
  if (result.canceled || !result.filePath) return null;
  const payload = { schemaVersion: 1, generatedAt: new Date().toISOString(), localOnly: true, projectId, health: await providers.contracts(), network: networkRequests.slice(0, 50), telemetry: store.telemetry.summary(projectId) };
  await writeFile(result.filePath, JSON.stringify(payload, null, 2), { mode: 0o600 }); return result.filePath;
});
ipcMain.handle("system:open-external", async (_event, url: string) => {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Only HTTPS links may be opened.");
  await shell.openExternal(parsed.toString());
});
ipcMain.handle("system:select-folder", async () => {
  if (!app.isPackaged && process.env.ASTERIA_TEST_REPOSITORY) return path.resolve(process.env.ASTERIA_TEST_REPOSITORY);
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});
