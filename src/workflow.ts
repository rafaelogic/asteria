import type { Project, ProviderId, SpecialistRole, WorkflowStep } from "./types.js";
import { providerForStar, starForRole } from "../modules/stars/shared/catalog.js";

export const PRODUCTION_WORKFLOW: WorkflowStep[] = [
  { id: "define", name: "Define", specialist: starForRole("planner").title, role: "planner", status: "active", required: true },
  { id: "design", name: "Design", specialist: starForRole("product_designer").title, role: "product_designer", status: "pending", required: true },
  { id: "architect", name: "Architect", specialist: starForRole("architect").title, role: "architect", status: "pending", required: true },
  { id: "scope", name: "Scope gate", specialist: "Human approval", role: "planner", status: "pending", required: true },
  { id: "frontend", name: "Frontend", specialist: starForRole("frontend").title, role: "frontend", status: "pending", parallelGroup: "build" },
  { id: "backend", name: "Backend", specialist: starForRole("backend").title, role: "backend", status: "pending", parallelGroup: "build" },
  { id: "devops", name: "DevOps", specialist: starForRole("devops").title, role: "devops", status: "pending", parallelGroup: "build" },
  { id: "integrate", name: "Integrate", specialist: starForRole("integrator").title, role: "integrator", status: "pending", required: true },
  { id: "review", name: "Review", specialist: starForRole("reviewer").title, role: "reviewer", status: "pending", required: true, attempt: 1 },
  { id: "qa", name: "QA", specialist: starForRole("qa").title, role: "qa", status: "pending", required: true, attempt: 1 },
  { id: "security", name: "Release audit", specialist: starForRole("security").title, role: "security", status: "pending", required: true },
  { id: "requirements", name: "Requirements", specialist: starForRole("planner").title, role: "planner", status: "pending", required: true },
  { id: "release", name: "Release gate", specialist: "Human approval", role: "devops", status: "pending", required: true },
  { id: "deploy", name: "Deploy", specialist: starForRole("devops").title, role: "devops", status: "pending", required: true },
  { id: "verify", name: "Verify", specialist: starForRole("qa").title, role: "qa", status: "pending", required: true },
  { id: "close", name: "Close", specialist: "Human + Planner", role: "planner", status: "pending", required: true }
];

export function recommendedRoles(idea: string): SpecialistRole[] {
  const text = idea.toLowerCase();
  const roles = new Set<SpecialistRole>(["planner", "architect", "frontend", "backend", "devops", "integrator", "reviewer", "qa", "security"]);
  if (/ui|user|web|mobile|dashboard|app|checkout|portal/.test(text)) {
    roles.add("product_designer");
    roles.add("ui_designer");
    roles.add("accessibility");
    roles.add("performance");
  }
  if (/database|data|migration|schema|analytics|telemetry/.test(text)) roles.add("database");
  return [...roles];
}

function activateNext(steps: WorkflowStep[]) {
  const next = steps.find((step) => step.status === "pending");
  if (!next) return steps;
  if (next.parallelGroup) {
    const group = next.parallelGroup;
    return steps.map((step) => step.parallelGroup === group && step.status === "pending" ? { ...step, status: "active" as const } : step);
  }
  return steps.map((step) => step.id === next.id ? { ...step, status: "active" as const } : step);
}

export function transitionWorkflow(project: Project, event: "complete" | "fail_review" | "fail_qa" | "approve" | "pause" | "resume"): Project {
  if (event === "pause") return { ...project, version: project.version + 1, runStatus: "paused", updatedAt: new Date().toISOString() };
  if (event === "resume") return { ...project, version: project.version + 1, runStatus: "active", updatedAt: new Date().toISOString() };
  const steps = project.workflow.map((step) => ({ ...step }));
  const failedId = event === "fail_review" ? "review" : event === "fail_qa" ? "qa" : undefined;
  if (failedId) {
    const failed = steps.find((step) => step.id === failedId);
    const attempt = (failed?.attempt ?? 1) + 1;
    if (failed) {
      failed.attempt = attempt;
      failed.status = attempt >= 3 ? "blocked" : "pending";
    }
    const build = steps.find((step) => step.id === "integrate");
    if (build) build.status = attempt >= 3 ? "blocked" : "active";
    return {
      ...project,
      version: project.version + 1,
      runStatus: attempt >= 3 ? "blocked" : "active",
      workflow: steps,
      currentAction: attempt >= 3
        ? { title: "Human direction required", detail: `${failedId} returned the same unresolved finding three times.`, milestone: "Iteration guard", tool: "approval", elapsed: "00:00:00", specialist: "Human" }
        : { title: "Resolving targeted findings", detail: `Developer iteration ${attempt} is addressing ${failedId} findings.`, milestone: `${failedId} iteration`, tool: "git worktree", elapsed: "00:00:00", specialist: "Developer Pool" },
      updatedAt: new Date().toISOString()
    };
  }
  const active = steps.filter((step) => step.status === "active");
  active.forEach((step) => { step.status = "complete"; });
  const advanced = activateNext(steps);
  const next = advanced.find((step) => step.status === "active");
  const complete = !next;
  return {
    ...project,
    version: project.version + 1,
    workflow: advanced,
    runStatus: complete ? "completed" : next?.id === "scope" || next?.id === "release" || next?.id === "close" ? "approval" : "active",
    currentAction: complete
      ? { title: "Starpath complete", detail: "All requirements are satisfied and closure is recorded.", milestone: "Complete", tool: "checkpoint", elapsed: "00:00:00", specialist: "Planner" }
      : { title: `${next?.name} in progress`, detail: `${next?.specialist} is executing the approved stage contract.`, milestone: next?.name ?? "", tool: next?.role ?? "", elapsed: "00:00:00", specialist: next?.specialist },
    updatedAt: new Date().toISOString()
  };
}

export function providerForRole(project: Pick<Project, "provider" | "roleProviders">, role: SpecialistRole): ProviderId {
  return providerForStar(project, role);
}
