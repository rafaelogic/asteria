import { randomUUID } from "node:crypto";
import type {
  DelegationContract, ExecutionProposal, Project, RadioBehaviorState, RadioContinuity,
  RadioIntent, RiskClassification, SpecialistRole, StopCondition,
} from "../../../src/types.js";

const privileged = /\b(?:sudo|pkexec|doas|password|credential)\b|\/(?:etc|usr|opt)\//i;
const protectedBranch = /\b(?:push|force[- ]?push)\b[\s\S]*\b(?:main|master)\b/i;
const destructive = /\b(?:delete|truncate|drop|erase|destroy|purge|wipe)\b/i;
const production = /\b(?:production|prod|live)\b/i;

export function classifyRadioIntent(operation: string): { intent: RadioIntent; confidence: "deterministic" | "model_required" } {
  const rules: Array<[RadioIntent, RegExp]> = [
    ["release", /\b(?:release|deploy|publish|install|staging)\b/i],
    ["repair", /\b(?:fix|repair|debug|incident|recover|rollback)\b/i],
    ["verify", /\b(?:verify|test|check|audit|review)\b/i],
    ["delegate", /\b(?:activate|delegate|star|constellation|specialist)\b/i],
    ["plan", /\b(?:plan|architect|design|strategy)\b/i],
    ["execute", /\b(?:implement|edit|change|build|create|update|run)\b/i],
    ["synthesize", /\b(?:summarize|synthesi[sz]e|resolve|compare)\b/i],
    ["classify", /\b(?:classify|triage|categorize)\b/i],
  ];
  const match = rules.find(([, pattern]) => pattern.test(operation));
  return match ? { intent: match[0], confidence: "deterministic" } : { intent: "query", confidence: "model_required" };
}

export function deterministicStopConditions(operation: string, risk: RiskClassification): StopCondition[] {
  const conditions: StopCondition[] = [];
  if (privileged.test(operation)) conditions.push("ambiguous_authority");
  if (protectedBranch.test(operation)) conditions.push("target_mismatch");
  if (risk === "destructive" && production.test(operation)) conditions.push("destructive_production");
  return conditions;
}

export function behaviorStates(intent: RadioIntent, risk: RiskClassification): RadioBehaviorState[] {
  const states: RadioBehaviorState[] = ["understand"];
  if (intent !== "query" && intent !== "classify") states.push(risk === "read" ? "plan" : "preflight");
  if (risk === "external_mutation" || risk === "destructive") states.push("authorize");
  if (intent === "delegate" || intent === "execute" || intent === "repair" || intent === "release") states.push("activate");
  if (intent === "execute" || intent === "repair" || intent === "release") states.push("execute");
  if (intent !== "query" && intent !== "classify") states.push("verify");
  states.push("synthesize", "checkpoint");
  return [...new Set(states)];
}

export function buildDelegation(input: {
  role: SpecialistRole;
  assignment: string;
  rationale: string;
  capabilities?: string[];
  risk: RiskClassification;
  activeRoles?: SpecialistRole[];
}): DelegationContract | undefined {
  if (input.activeRoles?.includes(input.role)) return undefined;
  return {
    id: randomUUID(),
    role: input.role,
    assignment: input.assignment,
    rationale: input.rationale,
    requiredCapabilities: input.capabilities ?? [],
    boundaries: ["Remain inside the Orbit and assigned Coordinate.", "Return evidence; do not claim RaDio's identity."],
    expectedEvidence: ["Changed artifacts or inspected sources", "Focused checks and their results"],
    returnConditions: ["Assignment is verified", "A stop condition or unresolved question requires RaDio"],
    independentVerifier: input.risk === "external_mutation" || input.risk === "destructive"
      ? input.role === "qa" ? "reviewer" : "qa"
      : undefined,
  };
}

export function createExecutionProposal(input: {
  operation: string;
  risk: RiskClassification;
  delegations?: DelegationContract[];
}): ExecutionProposal {
  const { intent } = classifyRadioIntent(input.operation);
  const stopConditions = deterministicStopConditions(input.operation, input.risk);
  return {
    id: randomUUID(),
    intent,
    operation: input.operation,
    risk: input.risk,
    states: stopConditions.length ? ["understand", "blocked"] : behaviorStates(intent, input.risk),
    planningStyle: input.risk === "read" || input.risk === "workspace_write"
      ? intent === "query" || intent === "classify" ? "immediate" : "concise_plan"
      : "authorization_required",
    delegations: [...new Map((input.delegations ?? []).map((item) => [item.role, item])).values()],
    stopConditions,
  };
}

export function emptyRadioContinuity(project: Pick<Project, "id" | "objective">): RadioContinuity {
  return {
    projectId: project.id,
    currentObjective: project.objective,
    behaviorState: "understand",
    decisions: [],
    evidence: [],
    unresolvedQuestions: [],
    activeConstellation: [],
    authorizationRequestIds: [],
    relayHistory: [],
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeRadioContinuity(project: Pick<Project, "id" | "objective" | "radioContinuity">): RadioContinuity {
  const defaults = emptyRadioContinuity(project);
  return { ...defaults, ...(project.radioContinuity ?? {}), projectId: project.id, currentObjective: project.objective };
}
