import type { Project, ProviderId, RiskClassification, SpecialistRole } from "../../../src/types.js";
import type { RaDioAccountVault } from "./account-vault.js";
import { DirectiveRegistry, ModelRouter, PromptComposer, type ComposedPrompt } from "../../shared/ai.js";
import { RaDioCore } from "./core.js";

export class RadioModule {
  private readonly core: RaDioCore;
  private readonly composer = new PromptComposer();

  constructor(accounts: RaDioAccountVault, private readonly directives: DirectiveRegistry, private readonly router: ModelRouter) {
    this.core = new RaDioCore(accounts);
  }

  policy(input: Parameters<RaDioCore["policy"]>[0]) { return this.core.policy(input); }
  selectAccount(project: Project, role: SpecialistRole, capabilities: string[], currentProvider?: ProviderId) {
    return this.core.selectAccount(project, role, capabilities, currentProvider);
  }
  scout(project: Project) { return this.core.scout(project); }
  checkpointDigest(value: unknown) { return this.core.checkpointDigest(value); }
  normalizeSettings(settings: Project["radio"]) { return this.core.normalizeSettings(settings); }

  compose(input: {
    provider: ProviderId;
    context: string;
    assignment: string;
    task: "synthesis" | "planning" | "implementation" | "repair" | "verification" | "classification" | "release";
    skills?: string;
    risk?: RiskClassification;
    repeatedFailures?: number;
    evidenceConflict?: boolean;
  }): ComposedPrompt {
    const safety = this.directives.forSubject("radio", "radio").find((item) => item.metadata.id === "asteria-safety");
    const identity = this.directives.forSubject("radio", "radio").find((item) => item.metadata.id === "radio-identity");
    if (!safety || !identity) throw new Error("RaDio directives are incomplete.");
    const selected = this.directives.forSubject("radio", "radio", input.task)
      .filter((item) => item.metadata.id !== safety.metadata.id && item.metadata.id !== identity.metadata.id)
      .filter((item) => item.metadata.id !== "radio-authorization" || input.risk === "external_mutation" || input.risk === "destructive");
    const tierRank = { fast: 0, balanced: 1, frontier: 2 } as const;
    const explicitTier = selected.reduce<"fast" | "balanced" | "frontier" | undefined>(
      (highest, directive) => !highest || tierRank[directive.metadata.modelTier] > tierRank[highest] ? directive.metadata.modelTier : highest,
      undefined,
    );
    const route = this.router.route({
      provider: input.provider,
      task: input.task,
      explicitTier,
      risk: input.risk,
      repeatedFailures: input.repeatedFailures,
      evidenceConflict: input.evidenceConflict,
    });
    if (route.blockedReason) throw new Error(route.blockedReason);
    return this.composer.compose({ safety, identity, directives: selected, skills: input.skills, context: input.context, assignment: input.assignment, route });
  }
}
