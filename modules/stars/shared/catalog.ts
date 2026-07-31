import rawCatalog from "./catalog.json" with { type: "json" };
import type { IncidentCategory, Project, ProviderId, SpecialistRole, StarContinuity, StarDefinition, StarIdentity } from "../../../src/types.js";

export const SPECIALIST_ROLES = [
  "planner", "product_designer", "ui_designer", "architect", "frontend", "backend", "database",
  "devops", "integrator", "reviewer", "qa", "security", "accessibility", "performance"
] as const satisfies readonly SpecialistRole[];

const roleSet = new Set<string>(SPECIALIST_ROLES);
function stringArray(value: unknown, field: string, role: string) {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Star ${role} requires a non-empty ${field} string array.`);
  }
  return value as string[];
}

export function validateStarCatalog(value: unknown): StarDefinition[] {
  if (!Array.isArray(value)) throw new Error("The Stars catalog must be an array.");
  const seen = new Set<string>();
  const definitions = value.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Star catalog entry ${index} must be an object.`);
    const item = entry as Record<string, unknown>;
    const id = item.id;
    if (typeof id !== "string" || !roleSet.has(id)) throw new Error(`Unsupported Star role: ${String(id)}.`);
    if (seen.has(id)) throw new Error(`Duplicate Star role: ${id}.`);
    seen.add(id);
    for (const field of ["title"] as const) {
      if (typeof item[field] !== "string" || !item[field].trim()) throw new Error(`Star ${id} requires ${field}.`);
    }
    if (item.preferredProvider !== undefined && item.preferredProvider !== "codex" && item.preferredProvider !== "claude") {
      throw new Error(`Star ${id} has an unsupported preferred provider.`);
    }
    return {
      id: id as SpecialistRole,
      title: item.title as string,
      capabilities: stringArray(item.capabilities, "capabilities", id),
      coordinates: stringArray(item.coordinates, "coordinates", id),
      incidentCategories: item.incidentCategories === undefined ? undefined : stringArray(item.incidentCategories, "incidentCategories", id) as IncidentCategory[],
      preferredProvider: item.preferredProvider as ProviderId | undefined,
    };
  });
  const missing = SPECIALIST_ROLES.filter((role) => !seen.has(role));
  if (missing.length) throw new Error(`Stars catalog is missing roles: ${missing.join(", ")}.`);
  return definitions;
}

export const STAR_CATALOG = validateStarCatalog(rawCatalog);
const starsByRole = new Map(STAR_CATALOG.map((star) => [star.id, star]));

export function starForRole(role: SpecialistRole) {
  const star = starsByRole.get(role);
  if (!star) throw new Error(`No Star definition exists for ${role}.`);
  return star;
}

export function starIdentity(projectId: string, role: SpecialistRole): StarIdentity {
  const star = starForRole(role);
  return { id: `${projectId}:${role}`, projectId, role, title: star.title };
}

export function emptyStarContinuity(projectId: string): Partial<Record<SpecialistRole, StarContinuity>> {
  return Object.fromEntries(SPECIALIST_ROLES.map((role) => [role, {
    identity: starIdentity(projectId, role),
    decisions: [],
    evidenceIds: [],
    openQuestions: [],
    updatedAt: "",
  }])) as Partial<Record<SpecialistRole, StarContinuity>>;
}

export function normalizeStarContinuity(project: Pick<Project, "id" | "starContinuity">) {
  const defaults = emptyStarContinuity(project.id);
  return Object.fromEntries(SPECIALIST_ROLES.map((role) => {
    const prior = project.starContinuity?.[role];
    return [role, prior ? { ...defaults[role]!, ...prior, identity: { ...defaults[role]!.identity, ...prior.identity } } : defaults[role]!];
  })) as Partial<Record<SpecialistRole, StarContinuity>>;
}

export function providerForStar(project: Pick<Project, "provider" | "roleProviders">, role: SpecialistRole): ProviderId {
  return project.roleProviders?.[role] ?? starForRole(role).preferredProvider ?? project.provider;
}

export function starForIncident(category: IncidentCategory): SpecialistRole {
  return STAR_CATALOG.find((star) => star.incidentCategories?.includes(category))?.id ?? "architect";
}
