import type { IdeaProposal, Project } from "../types";

export const RaDioCorePreview = {
  scout(project: Project): IdeaProposal[] {
    const now = new Date().toISOString();
    return [
      ["Turn approval waits into guided decisions", "Approval gates can interrupt momentum when evidence is spread across screens.", "Create a decision brief linking risk, evidence, responsible agent, and the safest next action.", "high", "reviewer"],
      ["Replay the primary user journey before staging", "Technical completion can hide end-to-end experience gaps.", "Let RaDio replay the main journey after QA and report friction before staging promotion.", "high", "qa"],
      ["Make specialist handoffs self-explanatory", "Agent transitions can leave assumptions and value unclear.", "Generate compact handoffs with decisions, evidence, open questions, and ownership.", "medium", "security"]
    ].map(([title, problem, opportunity, impact, critical], index) => ({
      id: crypto.randomUUID(), projectId: project.id, title, problem, opportunity,
      persona: project.audience || "Project owner", confidence: .84 - index * .07, impact: impact as "high" | "medium",
      effort: index ? "small" : "medium", risk: "read", status: "new",
      evidence: [{ id: crypto.randomUUID(), title: "Project objective", source: "project", reference: project.id, summary: project.objective, capturedAt: now }],
      panelRoles: ["planner", "product_designer", critical] as IdeaProposal["panelRoles"],
      recommendation: "Discuss with the specialist panel, validate the evidence, then promote if the expected value holds.", createdAt: now
    }));
  }
};
