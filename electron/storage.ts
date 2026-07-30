import { safeStorage } from "electron";
import Database from "better-sqlite3-multiple-ciphers";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ApplicationMaintenanceSettings, OnboardingDraft, Project, RaDioMemoryEntry, SkillExecution, TelemetryEvent, TelemetryPolicy, TelemetrySummary } from "../src/types.js";
import { PRODUCTION_WORKFLOW, recommendedRoles, transitionWorkflow } from "../src/workflow.js";
import { DEFAULT_RADIO_SETTINGS } from "../src/radio.js";
import { defaultTakeover } from "./radio/supervisor.js";
import { ensurePrivateDirectory, ensurePrivateFile } from "./file-permissions.js";

export interface AsteriaStore {
  db: Database.Database;
  projects: ProjectRepository;
  telemetry: TelemetryRepository;
  skills: SkillStateRepository;
  maintenance: MaintenanceRepository;
  close(): void;
}

const MAX_MAINTENANCE_MESSAGES = 100;
const MAX_MAINTENANCE_BODY_LENGTH = 64 * 1024;

export function compactMaintenanceState(value: ApplicationMaintenanceSettings): ApplicationMaintenanceSettings {
  const messages = value.chat.messages.slice(-MAX_MAINTENANCE_MESSAGES).map((message) => ({
    ...message,
    body: message.body.length > MAX_MAINTENANCE_BODY_LENGTH
      ? `${message.body.slice(0, MAX_MAINTENANCE_BODY_LENGTH)}\n\n[Earlier maintenance output truncated.]`
      : message.body,
    cards: message.cards.slice(-20),
  }));
  return {
    ...value,
    automation: { ...(value.automation ?? { enabled: true, autoInstall: true, paused: false, emergencyStopped: false, startupInspection: true, intervalMinutes: 30, dailyFeatureLimit: 1, cycleRunning: false, status: "idle", idleStatus: "Waiting for the next cycle", nextCycleAt: new Date(Date.now() + 30 * 60_000).toISOString() }), autoInstall: value.automation?.autoInstall ?? true },
    goals: value.goals ?? [],
    findings: value.findings ?? [],
    chat: { ...value.chat, messages }
  };
}

export class MaintenanceRepository {
  constructor(private db: Database.Database) {}
  get(): ApplicationMaintenanceSettings {
    const row = this.db.prepare("SELECT value_json FROM settings WHERE key = 'radio.maintenance'").get() as { value_json: string } | undefined;
    if (row) return compactMaintenanceState(JSON.parse(row.value_json) as ApplicationMaintenanceSettings);
    const now = new Date().toISOString();
    return { version: 1, provider: "codex", automation: { enabled: true, autoInstall: true, paused: false, emergencyStopped: false, startupInspection: true, intervalMinutes: 30, dailyFeatureLimit: 1, cycleRunning: false, status: "idle", idleStatus: "Waiting for the next cycle", nextCycleAt: new Date(Date.now() + 30 * 60_000).toISOString() }, goals: [], findings: [], chat: { id: randomUUID(), messages: [], createdAt: now, updatedAt: now }, updatedAt: now };
  }
  save(value: ApplicationMaintenanceSettings, expectedVersion: number, idempotencyKey: string) {
    const prior = this.db.prepare("SELECT result_json FROM idempotency WHERE key = ?").get(idempotencyKey) as { result_json: string } | undefined;
    if (prior) return JSON.parse(prior.result_json) as ApplicationMaintenanceSettings;
    const current = this.get();
    if (current.version !== expectedVersion) throw new Error("Maintenance RaDio changed in another operation. Refresh before retrying.");
    const updated = { ...value, version: expectedVersion + 1, updatedAt: new Date().toISOString() };
    this.db.transaction(() => {
      this.db.prepare("INSERT INTO settings(key, value_json) VALUES ('radio.maintenance', ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json").run(JSON.stringify(updated));
      this.db.prepare("INSERT INTO idempotency VALUES (?, ?, ?)").run(idempotencyKey, JSON.stringify(updated), updated.updatedAt);
    })();
    return updated;
  }
}

export const DEFAULT_TELEMETRY_POLICY: TelemetryPolicy = {
  enabled: true,
  replayEnabled: true,
  retentionDays: 30,
  quotaBytes: 5 * 1024 * 1024 * 1024
};

interface StorageRecovery {
  occurred: boolean;
  path?: string;
  reason?: string;
}

function preserveLockedStore(dataRoot: string, reason: string): StorageRecovery {
  const recoveryRoot = path.join(dataRoot, "recovery");
  const recoveryPath = path.join(recoveryRoot, `locked-store-${Date.now()}`);
  mkdirSync(recoveryPath, { recursive: true, mode: 0o700 });

  const databaseFiles = ["asteria.sqlite3", "asteria.sqlite3-wal", "asteria.sqlite3-shm"];
  for (const name of databaseFiles) {
    const source = path.join(dataRoot, name);
    if (existsSync(source)) renameSync(source, path.join(recoveryPath, name));
  }

  const vaultPath = path.join(dataRoot, "vault");
  if (existsSync(vaultPath)) {
    const preservedVault = path.join(recoveryPath, "vault");
    mkdirSync(preservedVault, { recursive: true, mode: 0o700 });
    for (const name of readdirSync(vaultPath)) {
      if (!name.startsWith("database-key.bin")) continue;
      renameSync(path.join(vaultPath, name), path.join(preservedVault, name));
    }
  }

  const state = {
    occurred: true,
    path: recoveryPath,
    reason,
    recoveredAt: new Date().toISOString()
  };
  writeFileSync(path.join(dataRoot, "recovery-state.json"), JSON.stringify(state, null, 2), { mode: 0o600 });
  return state;
}

function loadDatabaseKey(dataRoot: string): { key: string; recovery: StorageRecovery } {
  if (!appIsPackaged() && process.env.ASTERIA_TEST_STORAGE_KEY) {
    return { key: process.env.ASTERIA_TEST_STORAGE_KEY, recovery: { occurred: false } };
  }
  const keyPath = path.join(dataRoot, "vault", "database-key.bin");
  mkdirSync(path.dirname(keyPath), { recursive: true, mode: 0o700 });
  if (existsSync(keyPath)) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("The OS credential vault is unavailable; encrypted storage cannot start.");
    try {
      return { key: safeStorage.decryptString(readFileSync(keyPath)), recovery: { occurred: false } };
    } catch (error) {
      const recovery = preserveLockedStore(dataRoot, "The OS credential vault could not decrypt the existing database key.");
      const key = randomBytes(32).toString("hex");
      writeFileSync(keyPath, safeStorage.encryptString(key), { mode: 0o600 });
      return { key, recovery };
    }
  }
  if (!safeStorage.isEncryptionAvailable()) throw new Error("The OS credential vault is unavailable; encrypted storage cannot start.");
  let recovery: StorageRecovery = { occurred: false };
  if (existsSync(path.join(dataRoot, "asteria.sqlite3"))) {
    recovery = preserveLockedStore(dataRoot, "The encrypted database existed without a readable database key.");
  }
  const key = randomBytes(32).toString("hex");
  writeFileSync(keyPath, safeStorage.encryptString(key), { mode: 0o600 });
  return { key, recovery };
}

function appIsPackaged() {
  return process.env.NODE_ENV === "production" && !process.env.VITE_DEV_SERVER_URL;
}

function migrate(db: Database.Database) {
  const version = Number(db.pragma("user_version", { simple: true }));
  if (version < 1) {
    const projectColumns = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    if (projectColumns.length && !projectColumns.some((column) => column.name === "data_json")) {
      const legacyTables = ["projects", "workflow_runs", "agent_events", "tasks", "threads", "thread_messages", "network_decisions"];
      for (const table of legacyTables) {
        const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(table);
        if (exists) db.exec(`ALTER TABLE "${table}" RENAME TO "${table}_legacy_v0"`);
      }
    }
    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE telemetry_events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        size_bytes INTEGER NOT NULL,
        UNIQUE(project_id, run_id, sequence)
      );
      CREATE INDEX telemetry_project_time ON telemetry_events(project_id, timestamp);
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
      CREATE TABLE idempotency (
        key TEXT PRIMARY KEY,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  }
  if (version < 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS skill_executions (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, operation_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS skill_execution_project_time ON skill_executions(project_id, created_at);
      CREATE TABLE IF NOT EXISTS radio_memory (
        id TEXT PRIMARY KEY, project_id TEXT, scope TEXT NOT NULL, kind TEXT NOT NULL,
        data_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS radio_memory_project_time ON radio_memory(project_id, updated_at);
      PRAGMA user_version = 2;
    `);
  }
  if (version < 3) {
    db.exec(`
      DELETE FROM idempotency WHERE key LIKE 'maintenance_event_%';
      PRAGMA user_version = 3;
    `);
    const row = db.prepare("SELECT value_json FROM settings WHERE key = 'radio.maintenance'").get() as { value_json: string } | undefined;
    if (row) {
      const compacted = compactMaintenanceState(JSON.parse(row.value_json) as ApplicationMaintenanceSettings);
      db.prepare("UPDATE settings SET value_json = ? WHERE key = 'radio.maintenance'").run(JSON.stringify(compacted));
    }
    db.exec("VACUUM");
  }
}

export class ProjectRepository {
  constructor(private db: Database.Database) {}

  list(): Project[] {
    return this.db.prepare("SELECT data_json FROM projects ORDER BY updated_at DESC").all()
      .map((row) => this.hydrate(JSON.parse((row as { data_json: string }).data_json) as Project));
  }

  get(id: string) {
    const row = this.db.prepare("SELECT data_json FROM projects WHERE id = ?").get(id) as { data_json: string } | undefined;
    return row ? this.hydrate(JSON.parse(row.data_json) as Project) : undefined;
  }

  private hydrate(project: Project): Project {
    return {
      ...project, artifacts: project.artifacts ?? [], approvals: project.approvals ?? [], messages: project.messages ?? [],
      tasks: project.tasks ?? [], events: project.events ?? [], radio: { ...DEFAULT_RADIO_SETTINGS, ...(project.radio ?? {}), accountPool: { ...DEFAULT_RADIO_SETTINGS.accountPool, ...(project.radio?.accountPool ?? {}) } },
      ideas: project.ideas ?? [], accountTransitions: project.accountTransitions ?? [], radioReports: project.radioReports ?? []
      ,skillExecutions: project.skillExecutions ?? [], incidents: project.incidents ?? [],
      takeover: project.takeover ?? defaultTakeover(project.id, project.runId, project.radio?.mode === "full_autonomous"),
      radioChats: project.radioChats ?? [{ id: randomUUID(), projectId: project.id, runId: project.runId, archived: false, messages: [], createdAt: project.createdAt, updatedAt: project.updatedAt }]
    };
  }

  create(draft: OnboardingDraft, idempotencyKey: string) {
    const existing = this.db.prepare("SELECT result_json FROM idempotency WHERE key = ?").get(idempotencyKey) as { result_json: string } | undefined;
    if (existing) return JSON.parse(existing.result_json) as Project;
    const now = new Date().toISOString();
    const id = `project_${randomUUID().slice(0, 8)}`;
    const runId = `run_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const activeRoles = new Set(draft.roles ?? recommendedRoles(draft.idea));
    const workflow = PRODUCTION_WORKFLOW
      .filter((step) => step.required || activeRoles.has(step.role))
      .map((step) => ({ ...step }));
    const project: Project = {
      id,
      version: 1,
      name: draft.projectName,
      repository: draft.repository || draft.repositoryPath.split(/[\\/]/).pop() || "Local repository",
      repositoryPath: draft.repositoryPath,
      objective: draft.idea,
      audience: draft.audience,
      constraints: draft.constraints,
      visibility: draft.githubConnected ? "Private" : "Local",
      provider: draft.defaultProvider,
      runId,
      runStatus: "active",
      workflow,
      currentAction: {
        title: "Defining product outcomes",
        detail: "Product Planner is turning the idea into traceable requirements and acceptance criteria.",
        milestone: "Product definition",
        tool: "RaDio Planner",
        elapsed: "00:00:00",
        specialist: "Product Planner",
        estimatedPhase: "Define"
      },
      events: [{ id: randomUUID(), projectId: id, runId, type: "message", timestamp: now, title: "Starpath created", detail: "Project isolation and local telemetry are ready.", specialist: "Asteria" }],
      tasks: [{ id: randomUUID(), projectId: id, title: "Define requirements and acceptance criteria", column: "Running", provider: draft.defaultProvider, meta: "Define · active", role: "planner", risk: "read", attempt: 1 }],
      messages: [{ id: randomUUID(), author: "Product Planner", role: "Product", body: "I’m translating the initial idea into measurable outcomes before design and architecture begin.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), tone: "cyan" }],
      artifacts: [],
      approvals: [],
      radio: draft.radio ?? DEFAULT_RADIO_SETTINGS,
      ideas: [],
      accountTransitions: [],
      radioReports: [],
      skillExecutions: [],
      incidents: [],
      takeover: defaultTakeover(id, runId, draft.radio?.mode === "full_autonomous"),
      radioChats: [{ id: randomUUID(), projectId: id, runId, archived: false, messages: [], createdAt: now, updatedAt: now }],
      budget: { minutes: 480, usedMinutes: 0, tokenLimit: 1_000_000, usedTokens: 0 },
      createdAt: now,
      updatedAt: now
    };
    this.db.transaction(() => {
      this.db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?, ?)").run(id, project.version, JSON.stringify(project), now, now);
      this.db.prepare("INSERT INTO idempotency VALUES (?, ?, ?)").run(idempotencyKey, JSON.stringify(project), now);
    })();
    return project;
  }

  save(project: Project, expectedVersion: number, idempotencyKey: string) {
    const existing = this.db.prepare("SELECT result_json FROM idempotency WHERE key = ?").get(idempotencyKey) as { result_json: string } | undefined;
    if (existing) return JSON.parse(existing.result_json) as Project;
    const current = this.get(project.id);
    if (!current) throw new Error("Project not found.");
    if (current.version !== expectedVersion) throw new Error("Project changed in another operation. Refresh before retrying.");
    const updated = { ...project, version: expectedVersion + 1, updatedAt: new Date().toISOString() };
    this.db.transaction(() => {
      const result = this.db.prepare("UPDATE projects SET version = ?, data_json = ?, updated_at = ? WHERE id = ? AND version = ?")
        .run(updated.version, JSON.stringify(updated), updated.updatedAt, updated.id, expectedVersion);
      if (result.changes !== 1) throw new Error("Stale project mutation rejected.");
      this.db.prepare("INSERT INTO idempotency VALUES (?, ?, ?)").run(idempotencyKey, JSON.stringify(updated), updated.updatedAt);
    })();
    return updated;
  }

  transition(id: string, expectedVersion: number, idempotencyKey: string, event: Parameters<typeof transitionWorkflow>[1]) {
    const project = this.get(id);
    if (!project) throw new Error("Project not found.");
    let transitioned = transitionWorkflow(project, event);
    if (transitioned.runStatus === "approval" && !transitioned.approvals.some((approval) => approval.status === "pending")) {
      const stage = transitioned.workflow.find((step) => step.status === "active");
      transitioned = {
        ...transitioned,
        approvals: [...transitioned.approvals, {
          id: randomUUID(),
          projectId: transitioned.id,
          runId: transitioned.runId,
          title: stage?.id === "release" ? "Approve production release" : stage?.id === "close" ? "Accept project closure" : "Approve project scope",
          detail: `Review the ${stage?.name ?? "workflow"} evidence before Asteria continues.`,
          risk: stage?.id === "release" ? "external_mutation" : "workspace_write",
          specialist: stage?.specialist ?? "Human",
          files: transitioned.artifacts.map((artifact) => artifact.name).slice(0, 8),
          createdAt: new Date().toISOString(),
          status: "pending"
        }]
      };
    }
    // transitionWorkflow increments for pure usage; save owns persistence versioning.
    return this.save({ ...transitioned, version: expectedVersion }, expectedVersion, idempotencyKey);
  }
}

export class SkillStateRepository {
  constructor(private db: Database.Database) {}
  executions(projectId: string): SkillExecution[] {
    return this.db.prepare("SELECT data_json FROM skill_executions WHERE project_id = ? ORDER BY created_at DESC").all(projectId)
      .map((row) => JSON.parse((row as { data_json: string }).data_json) as SkillExecution);
  }
  saveExecution(execution: SkillExecution) {
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO skill_executions VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(operation_id) DO UPDATE SET status=excluded.status, data_json=excluded.data_json, updated_at=excluded.updated_at`)
      .run(execution.id, execution.projectId, execution.operationId, execution.status, JSON.stringify(execution), execution.startedAt, now);
    return execution;
  }
  memory(projectId: string): RaDioMemoryEntry[] {
    return this.db.prepare("SELECT data_json FROM radio_memory WHERE project_id = ? OR (project_id IS NULL AND scope = 'owner') ORDER BY updated_at DESC").all(projectId)
      .map((row) => JSON.parse((row as { data_json: string }).data_json) as RaDioMemoryEntry);
  }
  remember(entry: RaDioMemoryEntry) {
    this.db.prepare(`INSERT INTO radio_memory VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json, kind=excluded.kind, updated_at=excluded.updated_at`)
      .run(entry.id, entry.projectId ?? null, entry.scope, entry.kind, JSON.stringify(entry), entry.createdAt, entry.updatedAt);
    return entry;
  }
  forget(id: string, projectId: string) {
    return this.db.prepare("DELETE FROM radio_memory WHERE id = ? AND (project_id = ? OR project_id IS NULL)").run(id, projectId).changes > 0;
  }
  memoryEntry(id: string, projectId: string) {
    const row = this.db.prepare("SELECT data_json FROM radio_memory WHERE id = ? AND (project_id = ? OR project_id IS NULL)").get(id, projectId) as { data_json: string } | undefined;
    return row ? JSON.parse(row.data_json) as RaDioMemoryEntry : undefined;
  }
}

export class TelemetryRepository {
  constructor(private db: Database.Database) {}

  policy(): TelemetryPolicy {
    const row = this.db.prepare("SELECT value_json FROM settings WHERE key = 'telemetry.policy'").get() as { value_json: string } | undefined;
    return row ? JSON.parse(row.value_json) as TelemetryPolicy : DEFAULT_TELEMETRY_POLICY;
  }

  setPolicy(policy: TelemetryPolicy) {
    this.db.prepare("INSERT INTO settings(key, value_json) VALUES ('telemetry.policy', ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json").run(JSON.stringify(policy));
    return policy;
  }

  append(event: TelemetryEvent) {
    const policy = this.policy();
    if (!policy.enabled) return;
    const usage = (this.db.prepare("SELECT COALESCE(SUM(size_bytes), 0) bytes FROM telemetry_events").get() as { bytes: number }).bytes;
    const replayLike = event.kind === "provider" || event.kind === "tool";
    if (usage >= policy.quotaBytes && replayLike) return;
    const serialized = JSON.stringify(event);
    this.db.prepare(`
      INSERT OR IGNORE INTO telemetry_events
      (id, project_id, run_id, sequence, timestamp, kind, name, payload_json, pinned, size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.id, event.projectId, event.runId, event.sequence, event.timestamp, event.kind, event.name, serialized, event.pinned ? 1 : 0, Buffer.byteLength(serialized));
    if (usage + Buffer.byteLength(serialized) >= policy.quotaBytes) this.enforceRetention();
  }

  events(projectId: string, runId: string) {
    return this.db.prepare("SELECT payload_json, pinned FROM telemetry_events WHERE project_id = ? AND run_id = ? ORDER BY sequence")
      .all(projectId, runId).map((row) => {
        const value = row as { payload_json: string; pinned: number };
        return { ...JSON.parse(value.payload_json) as TelemetryEvent, pinned: Boolean(value.pinned) };
      });
  }

  summary(projectId?: string): TelemetrySummary {
    const where = projectId ? "WHERE project_id = ?" : "";
    const args = projectId ? [projectId] : [];
    const aggregate = this.db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(size_bytes), 0) bytes FROM telemetry_events ${where}`).get(...args) as { count: number; bytes: number };
    const events = this.db.prepare(`SELECT payload_json FROM telemetry_events ${where} ORDER BY timestamp DESC LIMIT 2000`).all(...args)
      .map((row) => JSON.parse((row as { payload_json: string }).payload_json) as TelemetryEvent);
    const policy = this.policy();
    const durations = events.reduce((sum, event) => sum + (event.durationMs ?? 0), 0);
    const review = events.filter((event) => event.stage === "review");
    const qa = events.filter((event) => event.stage === "qa");
    const providerStats = (["codex", "claude"] as const).map((provider) => {
      const matching = events.filter((event) => event.provider === provider && event.kind === "provider");
      const succeeded = matching.filter((event) => event.outcome === "succeeded").length;
      return { provider, runs: matching.length, successRate: matching.length ? succeeded / matching.length : 0, avgMinutes: matching.length ? matching.reduce((sum, event) => sum + (event.durationMs ?? 0), 0) / matching.length / 60_000 : 0, cost: matching.reduce((sum, event) => sum + Number(event.payload.cost ?? 0), 0) };
    });
    const stages = [...new Set(events.map((event) => event.stage).filter(Boolean))] as string[];
    return {
      totalEvents: aggregate.count,
      replayEvents: events.length,
      storageBytes: aggregate.bytes,
      quotaBytes: policy.quotaBytes,
      retentionDays: policy.retentionDays,
      enabled: policy.enabled,
      replayEnabled: policy.replayEnabled,
      cycleMinutes: durations / 60_000,
      approvalWaitMinutes: events.filter((event) => event.kind === "approval").reduce((sum, event) => sum + (event.durationMs ?? 0), 0) / 60_000,
      reviewRejectionRate: review.length ? review.filter((event) => event.outcome === "failed").length / review.length : 0,
      qaRejectionRate: qa.length ? qa.filter((event) => event.outcome === "failed").length / qa.length : 0,
      providerStats,
      stageStats: stages.map((stage) => {
        const matching = events.filter((event) => event.stage === stage);
        return { stage, minutes: matching.reduce((sum, event) => sum + (event.durationMs ?? 0), 0) / 60_000, attempts: matching.length, outcome: matching[0]?.outcome ?? "started" };
      })
    };
  }

  pin(projectId: string, runId: string, pinned: boolean) {
    this.db.prepare("UPDATE telemetry_events SET pinned = ? WHERE project_id = ? AND run_id = ?").run(pinned ? 1 : 0, projectId, runId);
  }

  clear(projectId?: string) {
    if (projectId) this.db.prepare("DELETE FROM telemetry_events WHERE project_id = ?").run(projectId);
    else this.db.prepare("DELETE FROM telemetry_events").run();
    this.db.pragma("wal_checkpoint(TRUNCATE)");
    this.db.exec("VACUUM");
  }

  enforceRetention() {
    const policy = this.policy();
    const cutoff = new Date(Date.now() - policy.retentionDays * 86_400_000).toISOString();
    const expired = this.db.prepare("DELETE FROM telemetry_events WHERE pinned = 0 AND timestamp < ?").run(cutoff).changes;
    let usage = (this.db.prepare("SELECT COALESCE(SUM(size_bytes), 0) bytes FROM telemetry_events").get() as { bytes: number }).bytes;
    let purged = 0;
    while (usage > policy.quotaBytes) {
      const row = this.db.prepare("SELECT id, size_bytes FROM telemetry_events WHERE pinned = 0 ORDER BY timestamp LIMIT 1").get() as { id: string; size_bytes: number } | undefined;
      if (!row) break;
      this.db.prepare("DELETE FROM telemetry_events WHERE id = ?").run(row.id);
      usage -= row.size_bytes;
      purged += 1;
    }
    return { expired, purged, usage };
  }
}

export function openStore(dataRoot: string): AsteriaStore {
  ensurePrivateDirectory(dataRoot);
  const { key } = loadDatabaseKey(dataRoot);
  const databasePath = path.join(dataRoot, "asteria.sqlite3");
  const db = new Database(databasePath);
  db.pragma(`key = "x'${key}'"`);
  db.pragma("cipher = 'sqlcipher'");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("secure_delete = ON");
  for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) ensurePrivateFile(file);
  migrate(db);
  const projects = new ProjectRepository(db);
  const telemetry = new TelemetryRepository(db);
  const skills = new SkillStateRepository(db);
  const maintenance = new MaintenanceRepository(db);
  telemetry.enforceRetention();
  return { db, projects, telemetry, skills, maintenance, close: () => db.close() };
}
