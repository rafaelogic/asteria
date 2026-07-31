import { createHash, randomUUID } from "node:crypto";
import type { IdeaProposal, Project, RaDioSettings, SpecialistRole } from "../../../src/types.js";
import { radioPolicyDecision, selectRaDioAccount } from "../shared/core.js";
import type { RaDioAccountVault } from "./account-vault.js";

export class RaDioCore {
  constructor(private accounts: RaDioAccountVault) {}

  policy = radioPolicyDecision;

  selectAccount(project: Project, role: SpecialistRole, capabilities: string[], currentProvider?: "codex" | "claude") {
    return selectRaDioAccount(this.accounts.list(), project.radio.accountPool, project.id, role, capabilities, currentProvider);
  }

  scout(project: Project): IdeaProposal[] {
    const now = new Date().toISOString();
    const sources = project.artifacts.slice(0, 2);
    const proposals = [
      { title: "Turn approval waits into guided decisions", problem: "Approval gates can interrupt momentum when evidence is spread across screens.", opportunity: "Create a single decision brief that links risk, evidence, responsible agent, and the safest next action.", persona: project.audience || "Project owner", impact: "high" as const, effort: "medium" as const, risk: "read" as const },
      { title: "Validate the workflow through a user journey replay", problem: "Technical completion can hide gaps in the end-to-end user experience.", opportunity: "Have RaDio replay the primary journey after QA and report friction before staging promotion.", persona: project.audience || "Primary user", impact: "high" as const, effort: "small" as const, risk: "workspace_write" as const },
      { title: "Make specialist handoffs self-explanatory", problem: "Agent transitions are visible but their value and unresolved assumptions may be unclear.", opportunity: "Generate a compact handoff summary with decisions, evidence, open questions, and ownership.", persona: "Human reviewer", impact: "medium" as const, effort: "small" as const, risk: "read" as const }
    ];
    return proposals.map((proposal, index) => ({
      ...proposal, id: randomUUID(), projectId: project.id, status: "new", confidence: .78 - index * .06,
      panelRoles: ["planner", index === 1 ? "qa" : "reviewer", index === 0 ? "product_designer" : "security"],
      recommendation: "Discuss with the specialist panel, validate the evidence, then promote if the expected value holds.",
      evidence: sources.length ? sources.map((artifact) => ({ id: randomUUID(), title: artifact.name, source: "project" as const, reference: artifact.id, summary: `${artifact.stage} evidence from the current project.`, capturedAt: now }))
        : [{ id: randomUUID(), title: "Project objective", source: "project", reference: project.id, summary: project.objective, capturedAt: now }],
      createdAt: now
    }));
  }

  checkpointDigest(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  normalizeSettings(settings: RaDioSettings) {
    return {
      ...settings,
      takeoverEnabled: settings.mode === "full_autonomous" ? true : settings.takeoverEnabled,
      stagingBranch: "staging",
      maxRepairAttempts: Math.min(3, Math.max(1, settings.maxRepairAttempts)),
      accountPool: { ...settings.accountPool, thresholdPercent: 5 }
    };
  }
}
