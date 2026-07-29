import type { AgentEvent, Artifact, Project, TaskCard, ThreadMessage, WorkflowStep } from "./types";
import { DEFAULT_RADIO_SETTINGS } from "./radio";

const now = new Date().toISOString();

export const workflow: WorkflowStep[] = [
  { id: "define", name: "Define", specialist: "Product Planner", role: "planner", status: "complete", required: true },
  { id: "design", name: "Design", specialist: "Product + UI Design", role: "product_designer", status: "complete", required: true },
  { id: "architect", name: "Architect", specialist: "Technical Architect", role: "architect", status: "complete", required: true },
  { id: "scope", name: "Scope gate", specialist: "Human approval", role: "planner", status: "complete", required: true },
  { id: "frontend", name: "Frontend", specialist: "Frontend Developer", role: "frontend", status: "active", parallelGroup: "build" },
  { id: "backend", name: "Backend", specialist: "Backend Developer", role: "backend", status: "active", parallelGroup: "build" },
  { id: "devops", name: "DevOps", specialist: "DevOps Engineer", role: "devops", status: "active", parallelGroup: "build" },
  { id: "integrate", name: "Integrate", specialist: "Integration Developer", role: "integrator", status: "pending", required: true },
  { id: "review", name: "Review", specialist: "Staff Reviewer", role: "reviewer", status: "pending", required: true, attempt: 1 },
  { id: "qa", name: "QA", specialist: "QA Engineer", role: "qa", status: "pending", required: true, attempt: 1 },
  { id: "security", name: "Audit", specialist: "Security + Privacy", role: "security", status: "pending", required: true },
  { id: "requirements", name: "Final check", specialist: "Product Planner", role: "planner", status: "pending", required: true },
  { id: "release", name: "Release", specialist: "Human + DevOps", role: "devops", status: "pending", required: true },
  { id: "close", name: "Close", specialist: "Human + Planner", role: "planner", status: "pending", required: true }
];

export const events: AgentEvent[] = [
  { id: "e1", type: "tool_start", timestamp: "10:24 AM", title: "Parallel build started", detail: "Three isolated worktrees active", specialist: "Developer Pool" },
  { id: "e2", type: "artifact", timestamp: "10:23 AM", title: "Scope approved", detail: "12 requirements · 18 acceptance checks", specialist: "Human" },
  { id: "e3", type: "completed", timestamp: "10:21 AM", title: "Architecture complete", detail: "API contracts and integration order frozen", specialist: "Architect" },
  { id: "e4", type: "message", timestamp: "10:18 AM", title: "Starpath initiated", detail: "Local replay enabled · 30-day retention", specialist: "Asteria" }
];

export const tasks: TaskCard[] = [
  { id: "t1", title: "Define repository isolation", column: "Done", provider: "codex", meta: "REQ-01 · complete", role: "architect", risk: "workspace_write", attempt: 1 },
  { id: "t2", title: "Build encrypted replay service", column: "Running", provider: "codex", meta: "Backend · active", role: "backend", risk: "workspace_write", attempt: 1 },
  { id: "t3", title: "Implement starpath insights", column: "Running", provider: "claude", meta: "Frontend · active", role: "frontend", risk: "workspace_write", attempt: 1 },
  { id: "t4", title: "Review provider event schema", column: "Review", provider: "claude", meta: "Review · waiting", role: "reviewer", risk: "read", attempt: 1 },
  { id: "t5", title: "Package signed desktop builds", column: "Backlog", provider: "claude", meta: "Release · planned", role: "devops", risk: "external_mutation", attempt: 1 },
  { id: "t6", title: "Approve new package destination", column: "Blocked", provider: "codex", meta: "Human approval needed", role: "security", risk: "external_mutation", attempt: 1 }
];

export const messages: ThreadMessage[] = [
  { id: "m1", threadId: "handoff-1", author: "Product Planner", role: "Requirements", body: "REQ-07 requires replay to remain usable after a restart without retaining unredacted provider output.", time: "10:18", tone: "cyan", decision: true },
  { id: "m2", threadId: "handoff-1", author: "Backend Developer", role: "Development", body: "Redaction now occurs before persistence. Replay frames carry sequence and correlation IDs for deterministic reconstruction.", time: "10:21", tone: "green" },
  { id: "m3", threadId: "handoff-1", author: "Security Reviewer", role: "Security", body: "Open question: confirm quota exhaustion keeps summary metrics while stopping full replay capture.", time: "10:24", tone: "violet", unresolved: true }
];

export const artifacts: Artifact[] = [
  { id: "ar1", projectId: "asteria", runId: "run_7f3c2b1a", name: "Product requirements", type: "brief", stage: "Define", createdAt: "Today, 09:42", size: "18 requirements", status: "approved" },
  { id: "ar2", projectId: "asteria", runId: "run_7f3c2b1a", name: "Starpath architecture", type: "architecture", stage: "Architect", createdAt: "Today, 10:11", size: "12 pages", status: "approved" },
  { id: "ar3", projectId: "asteria", runId: "run_7f3c2b1a", name: "Privacy regression audit", type: "audit", stage: "Audit", createdAt: "Today, 10:24", size: "0 findings", status: "review" }
];

function project(input: Partial<Project> & Pick<Project, "id" | "name" | "repository" | "objective" | "provider" | "runId">): Project {
  return {
    version: 1,
    visibility: "Private",
    runStatus: "active",
    workflow,
    currentAction: { title: "Parallel implementation underway", detail: "Frontend, backend, and DevOps specialists are working in isolated worktrees.", milestone: "Parallel build", tool: "3 worktrees", elapsed: "00:14:37", specialist: "Developer Pool", estimatedPhase: "Build · 42%" },
    events,
    tasks,
    messages,
    artifacts: artifacts.map((artifact) => ({ ...artifact, projectId: input.id, runId: input.runId })),
    approvals: [{
      id: "approval_scope",
      projectId: input.id,
      runId: input.runId,
      title: "Approve workspace changes",
      detail: "Developer Pool will edit the isolated project worktrees.",
      risk: "workspace_write",
      specialist: "Human",
      files: ["src/", "electron/", "tests/"],
      createdAt: now,
      status: "pending"
    }],
    radio: { ...DEFAULT_RADIO_SETTINGS, accountPool: { ...DEFAULT_RADIO_SETTINGS.accountPool, enabled: true, accountIds: ["demo-codex", "demo-claude"] } },
    ideas: [],
    accountTransitions: [],
    radioReports: [],
    skillExecutions: [],
    budget: { minutes: 480, usedMinutes: 128, tokenLimit: 1_000_000, usedTokens: 284_000 },
    createdAt: now,
    updatedAt: now,
    ...input
  };
}

export const projects: Project[] = [
  project({ id: "asteria", name: "Asteria Control Plane", repository: "asteria/control-plane", objective: "Ship a private, production-ready multi-agent development control plane.", provider: "codex", runId: "run_7f3c2b1a" }),
  project({
    id: "atlas", name: "Atlas Commerce", repository: "atlas/storefront", objective: "Launch an accessible checkout with reliable recovery.", provider: "claude", runId: "run_a91d82ef",
    currentAction: { title: "Reviewing checkout recovery", detail: "Reviewer is comparing frontend recovery states with backend idempotency guarantees.", milestone: "Integration review", tool: "git diff", elapsed: "00:12:08", specialist: "Staff Reviewer", estimatedPhase: "Review · 68%" },
    workflow: workflow.map((step) => ({ ...step, status: ["define", "design", "architect", "scope", "frontend", "backend", "devops", "integrate"].includes(step.id) ? "complete" : step.id === "review" ? "active" : "pending" })),
    tasks: tasks.slice(0, 4),
    messages: messages.slice(0, 2)
  }),
  project({
    id: "pulse", name: "Pulse Mobile", repository: "local/pulse-mobile", objective: "Define and validate an offline-first team status experience.", provider: "codex", runId: "run_c30be671", visibility: "Local",
    currentAction: { title: "Defining product outcomes", detail: "Planner is converting the initial idea into measurable stories and constraints.", milestone: "Product definition", tool: "RaDio Planner", elapsed: "00:02:19", specialist: "Product Planner", estimatedPhase: "Define · 8%" },
    workflow: workflow.map((step) => ({ ...step, status: step.id === "define" ? "active" : "pending" })),
    tasks: [tasks[0]],
    messages: [messages[0]]
  })
];
