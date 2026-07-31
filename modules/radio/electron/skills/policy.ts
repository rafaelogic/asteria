import path from "node:path";
import type { Project, SkillManifest, SkillPolicyDecision } from "../../../../src/types.js";
import { radioPolicyDecision } from "../../shared/core.js";

export interface AdapterInvocation {
  operationId: string;
  adapterId: string;
  operation: string;
  worktreePath?: string;
  branch?: string;
  environment: "workspace" | "staging" | "production";
}

export function validateAdapterInvocation(project: Project, manifest: SkillManifest, input: AdapterInvocation): SkillPolicyDecision {
  if (!input.operationId || !/^[a-zA-Z0-9:_-]{8,240}$/.test(input.operationId)) return { decision: "deny", reason: "A stable operation ID is required." };
  if (!manifest.requiredAdapters.includes(input.adapterId)) return { decision: "deny", reason: "The skill did not declare this adapter." };
  if (!project.repositoryPath) return { decision: "deny", reason: "The Orbit has no registered repository." };
  if (input.worktreePath) {
    const repository = path.resolve(project.repositoryPath);
    const worktree = path.resolve(input.worktreePath);
    const known = project.tasks.some((task) => task.worktreePath && path.resolve(task.worktreePath) === worktree);
    if (worktree !== repository && !known) return { decision: "deny", reason: "Worktree is outside the Orbit boundary." };
  }
  if (project.budget.usedMinutes >= project.budget.minutes || project.budget.usedTokens >= project.budget.tokenLimit) return { decision: "deny", reason: "Orbit budget is exhausted." };
  return radioPolicyDecision({ settings: project.radio, risk: manifest.risk, operation: input.operation, branch: input.branch, environment: input.environment });
}
