import type { Project, ProviderId, RiskClassification, SpecialistRole } from "../../../src/types.js";
import { DirectiveRegistry, ModelRouter, PromptComposer, type ComposedPrompt, type Directive } from "../../shared/ai.js";
import { StarCore } from "./core.js";
import { SPECIALIST_ROLES } from "../shared/catalog.js";

export class StarsModule extends StarCore {
  private readonly composer = new PromptComposer();

  constructor(private readonly directives: DirectiveRegistry, private readonly router: ModelRouter) {
    super();
    const missing = SPECIALIST_ROLES.filter((role) => !directives.list("stars").some((item) => item.metadata.subject === role));
    if (missing.length) throw new Error(`Star directives are missing roles: ${missing.join(", ")}.`);
  }

  resolveRelay(provider: ProviderId, role: SpecialistRole, tier: "fast" | "balanced" | "frontier") {
    return this.router.route({ provider, role, explicitTier: tier });
  }

  composeAssignment(project: Project, role: SpecialistRole, input: {
    provider: ProviderId;
    coordinate: string;
    objective: string;
    constraints?: string;
    specialistInstructions?: string;
    skills?: string;
    risk?: RiskClassification;
    repeatedFailures?: number;
    evidenceConflict?: boolean;
    task?: "planning" | "implementation" | "verification" | "release";
  }): ComposedPrompt {
    const safety = this.directives.forSubject("radio", "radio").find((item) => item.metadata.id === "asteria-safety");
    const exact = this.directives.forSubject("stars", role, input.coordinate);
    const identity = exact[0];
    if (!safety || !identity) throw new Error(`Star directives are incomplete for ${role}.`);
    const catalog = this.definition(role);
    const continuity = project.starContinuity?.[role];
    const context = [
      `Orbit: ${project.name}`,
      `Objective: ${input.objective}`,
      `Coordinate: ${input.coordinate}`,
      `Stable identity: ${continuity?.identity.id ?? `${project.id}:${role}`}`,
      `Role title: ${catalog.title}`,
      `Previous assignment: ${continuity?.latestAssignment ?? "none"}`,
      `Previous handoff: ${continuity?.handoffSummary ?? "none"}`,
      `Recorded decisions: ${continuity?.decisions.join("; ") || "none"}`,
      `Open questions: ${continuity?.openQuestions.join("; ") || "none"}`,
    ].join("\n");
    const assignment = [
      `Constraints: ${input.constraints || "None supplied"}`,
      input.specialistInstructions ?? "Produce the Coordinate contract, implementation, tests, and evidence appropriate to my role.",
      "I speak in first person as my persistent Star role, work only inside the isolated worktree, and report evidence to RaDio.",
    ].join("\n");
    const route = this.router.route({
      provider: input.provider,
      role,
      risk: input.risk,
      explicitTier: identity.metadata.modelTier,
      task: input.task ?? "implementation",
      repeatedFailures: input.repeatedFailures,
      evidenceConflict: input.evidenceConflict,
    });
    if (route.blockedReason) throw new Error(route.blockedReason);
    return this.composer.compose({
      safety,
      identity: identity as Directive,
      directives: exact.slice(1),
      skills: input.skills,
      context,
      assignment,
      route,
    });
  }
}
