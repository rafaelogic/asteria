import { createHash, randomUUID } from "node:crypto";
import type { HealthIncident, HealthSignal, IncidentCategory, Project, RaDioChatCommand, SpecialistRole, TakeoverState } from "../../src/types.js";
import { radioPolicyDecision } from "../../src/radio.js";

const routing: Record<IncidentCategory, SpecialistRole> = {
  renderer: "frontend", electron: "backend", provider: "devops", tool: "integrator", build: "devops",
  test: "qa", git: "integrator", storage: "database", security: "security", packaging: "devops", startup: "devops", unknown: "architect"
};

export function defaultTakeover(projectId: string, runId: string, enabled = false): TakeoverState {
  return { projectId, runId, enabled, phase: enabled ? "inspecting" : "idle", health: "healthy", updatedAt: new Date().toISOString() };
}

export function classifyHealth(source: string, operation: string, message: string): IncidentCategory {
  const value = `${source} ${operation} ${message}`.toLowerCase();
  if (/renderer|react|vite|dom|console/.test(value)) return "renderer";
  if (/electron|main process|ipc/.test(value)) return "electron";
  if (/provider|codex|claude|quota|authentication/.test(value)) return "provider";
  if (/git|worktree|branch|merge|rebase|push/.test(value)) return "git";
  if (/sqlite|database|migration|storage|vault/.test(value)) return "storage";
  if (/security|secret|permission|vulnerab/.test(value)) return "security";
  if (/package|installer|electron-builder/.test(value)) return "packaging";
  if (/startup|launch|heartbeat|relaunch/.test(value)) return "startup";
  if (/test|assert|expect|playwright|vitest/.test(value)) return "test";
  if (/build|compile|typescript|typecheck|lint/.test(value)) return "build";
  if (/tool|command|timeout/.test(value)) return "tool";
  return "unknown";
}

export function healthFingerprint(category: IncidentCategory, source: string, operation: string, message: string) {
  const normalized = message.toLowerCase().replace(/[a-f0-9]{8,}/g, "<id>").replace(/\d+/g, "<n>").replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`${category}|${source}|${operation}|${normalized}`).digest("hex");
}

export function recordIncident(project: Project, input: { source: string; operation: string; message: string; severity?: HealthSignal["severity"] }) {
  const category = classifyHealth(input.source, input.operation, input.message);
  const fingerprint = healthFingerprint(category, input.source, input.operation, input.message);
  const now = new Date().toISOString();
  const signal: HealthSignal = { id: randomUUID(), projectId: project.id, runId: project.runId, source: input.source, category, operation: input.operation, message: input.message, severity: input.severity ?? "error", evidenceDigest: createHash("sha256").update(input.message).digest("hex"), capturedAt: now, redacted: true };
  const existing = project.incidents.find((item) => item.fingerprint === fingerprint && item.status !== "resolved");
  if (existing) return project.incidents.map((item) => item.id === existing.id ? { ...item, signals: [...item.signals, signal], updatedAt: now } : item);
  const owner = routing[category];
  const incident: HealthIncident = {
    id: randomUUID(), fingerprint, projectId: project.id, runId: project.runId, category,
    title: `${category.charAt(0).toUpperCase()}${category.slice(1)} failure`, detail: input.message,
    severity: signal.severity, status: project.radio.mode === "full_autonomous" ? "repairing" : "open", owner, signals: [signal], attempts: [],
    plan: { incidentId: "", owner, verifier: owner === "qa" ? "reviewer" : "qa", skillIds: [category === "git" ? "repository-manager" : category === "security" ? "security-reviewer" : category === "test" ? "test-repair" : "incident-recovery"], summary: `Diagnose and repair the ${category} failure, then verify the affected release contract.`, createdAt: now },
    createdAt: now, updatedAt: now
  };
  incident.plan!.incidentId = incident.id;
  return [incident, ...project.incidents];
}

export function classifyChatCommand(body: string): RaDioChatCommand {
  const text = body.toLowerCase();
  const kind: RaDioChatCommand["kind"] =
    /pause|resume|takeover/.test(text) ? "takeover" : /health|error|incident|scan/.test(text) ? "health" :
    /install|reinstall|rollback/.test(text) ? "install" : /build|test|check/.test(text) ? "build" :
    /push|staging/.test(text) ? "staging" : /star|agent|developer|reviewer/.test(text) ? "star" :
    /task|ticket|kanban/.test(text) ? "task" : /skill/.test(text) ? "skill" : /report|observation/.test(text) ? "observation" :
    /priority|objective|focus/.test(text) ? "priority" : "query";
  const operation = body.trim();
  if (/(?:^|\s)(?:sudo|pkexec|su|doas)(?:\s|$)|password|\/(?:etc|usr|opt)\/|\b(?:main|master)\b/i.test(operation)) return { id: randomUUID(), kind, operation, status: "denied", policyReason: "RaDio chat cannot request privileged commands, system writes, credentials, or direct main/master operations." };
  return { id: randomUUID(), kind, operation, status: "proposed", policyReason: "Command must be evaluated against the active Orbit policy." };
}

export function maintenanceRequiresSource(body: string) {
  return /\b(analy[sz]e|inspect|diagnose|debug|edit|change|modify|implement|fix|repair|test|build|package|reinstall|stage|source|code|repository|repo)\b/i.test(body);
}

export function maintenanceRequiresPreview(body: string) {
  return /\b(visual|preview|browser|renderer|screenshot|ui|user interface|layout|responsive)\b/i.test(body);
}

export function decideChatCommand(project: Project, command: RaDioChatCommand) {
  if (command.status === "denied") return command;
  const external = command.kind === "staging" || command.kind === "install";
  const decision = radioPolicyDecision({ settings: project.radio, risk: external ? "external_mutation" : command.kind === "query" || command.kind === "health" ? "read" : "workspace_write", operation: command.operation, branch: command.kind === "staging" ? "staging" : undefined, environment: command.kind === "install" ? "workspace" : undefined });
  return {
    ...command,
    status:
      decision.decision === "allow"
        ? "allowed" as const
        : decision.decision === "deny"
          ? "denied" as const
          : "approval" as const,
    policyReason: decision.reason,
  };
}
