import type { Project, ProviderId, SpecialistRole } from "../../../src/types.js";
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
    task: "synthesis" | "planning" | "implementation" | "verification" | "classification" | "release";
    skills?: string;
  }): ComposedPrompt {
    const safety = this.directives.forSubject("radio", "radio").find((item) => item.metadata.id === "asteria-safety");
    const identity = this.directives.forSubject("radio", "radio").find((item) => item.metadata.id === "radio-identity");
    if (!safety || !identity) throw new Error("RaDio directives are incomplete.");
    const route = this.router.route({ provider: input.provider, explicitTier: identity.metadata.modelTier, task: input.task });
    if (route.blockedReason) throw new Error(route.blockedReason);
    return this.composer.compose({ safety, identity, skills: input.skills, context: input.context, assignment: input.assignment, route });
  }
}
