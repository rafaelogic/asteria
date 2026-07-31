import type { Project, ProviderId, SpecialistRole, StarContinuity } from "../../../src/types.js";
import { normalizeStarContinuity, providerForStar, starForRole } from "../shared/catalog.js";

export class StarCore {
  definition(role: SpecialistRole) {
    return starForRole(role);
  }

  provider(project: Pick<Project, "provider" | "roleProviders">, role: SpecialistRole) {
    return providerForStar(project, role);
  }

  beginAssignment(project: Project, role: SpecialistRole, assignment: string, provider: ProviderId) {
    const continuity = normalizeStarContinuity(project);
    const current = continuity[role]!;
    return {
      ...continuity,
      [role]: { ...current, latestAssignment: assignment, provider, updatedAt: new Date().toISOString() }
    } as Partial<Record<SpecialistRole, StarContinuity>>;
  }

  handoff(role: SpecialistRole, input: { decisions?: string[]; evidenceIds?: string[]; openQuestions?: string[]; summary: string }) {
    const star = this.definition(role);
    return {
      role,
      title: star.title,
      summary: `I am the ${star.title}. ${input.summary}`,
      decisions: input.decisions ?? [],
      evidenceIds: input.evidenceIds ?? [],
      openQuestions: input.openQuestions ?? [],
    };
  }
}
