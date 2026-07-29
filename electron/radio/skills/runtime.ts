import { randomUUID } from "node:crypto";
import type { Project, SkillExecution, SkillManifest, SkillPolicyDecision, SpecialistRole } from "../../../src/types.js";
import { radioPolicyDecision } from "../../../src/radio.js";
import { SkillRegistry } from "./registry.js";
import { validateAdapterInvocation } from "./policy.js";

export class SkillRuntime {
  constructor(private registry: SkillRegistry) {}

  prepare(project: Project, coordinate: string, role: SpecialistRole, operationId: string, provider?: "codex" | "claude", accountProfileId?: string, sessionId?: string) {
    const selected = this.registry.select(project, coordinate, role);
    return selected.map(({ manifest }) => this.execution(project, manifest, coordinate, role, operationId, provider, accountProfileId, sessionId));
  }

  prompt(manifests: SkillManifest[]) {
    if (!manifests.length) return "No compatible RaDio skill was activated; follow the Coordinate role contract.";
    return `Activated RaDio skills (instructions do not grant permissions):\n${manifests.map((skill) =>
      `- ${skill.name} ${skill.version} [${skill.id}]: ${skill.instructions}\n  Success: ${skill.successCriteria.join("; ")}\n  Evidence: ${skill.evidence.join("; ")}`
    ).join("\n")}`;
  }

  private execution(project: Project, manifest: SkillManifest, coordinate: string, role: SpecialistRole, operationId: string, provider?: "codex" | "claude", accountProfileId?: string, sessionId?: string): SkillExecution {
    const environment = /production/i.test(coordinate) ? "production" : /stage/i.test(coordinate) ? "staging" : "workspace";
    let policy: SkillPolicyDecision = radioPolicyDecision({ settings: project.radio, risk: manifest.risk, operation: `activate skill ${manifest.id}`, environment });
    for (const adapterId of manifest.requiredAdapters) {
      const adapterPolicy = validateAdapterInvocation(project, manifest, { operationId: `${operationId}:${manifest.id}:${adapterId}`, adapterId, operation: `activate ${adapterId} for ${manifest.id}`, environment, worktreePath: project.repositoryPath });
      if (adapterPolicy.decision === "deny" || (adapterPolicy.decision === "approval" && policy.decision === "allow")) policy = adapterPolicy;
    }
    const now = new Date().toISOString();
    return {
      id: randomUUID(), operationId: `${operationId}:${manifest.id}`, projectId: project.id, runId: project.runId,
      skillId: manifest.id, skillVersion: manifest.version, coordinate, role,
      status: policy.decision === "allow" ? "running" : "blocked", provider, accountProfileId, sessionId,
      startedAt: now, attempt: 1, policy, adapterIds: manifest.requiredAdapters, evidence: []
    };
  }
}
