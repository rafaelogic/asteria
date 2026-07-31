import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { Project, SkillCompatibility, SkillManifest, SkillRecord, SpecialistRole } from "../../../../src/types.js";
import { BUILTIN_SKILLS } from "./catalog.js";
import { CAPABILITY_ADAPTERS } from "./adapters.js";
import { OrbitSkillSchema } from "./schema.js";

const roles = new Set(["planner","product_designer","ui_designer","architect","frontend","backend","database","devops","integrator","reviewer","qa","security","accessibility","performance"]);

export class SkillRegistry {
  discover(project: Project): SkillRecord[] {
    const manifests = [...BUILTIN_SKILLS, ...this.orbitSkills(project)];
    this.assertAcyclic(manifests);
    return manifests.map((manifest) => {
      const compatibility = this.compatibility(project, manifest);
      const approved = manifest.source === "builtin" || project.radio.approvedOrbitSkillDigests[manifest.id] === manifest.integrity;
      const enabled = project.radio.skillsEnabled && !project.radio.disabledSkillIds.includes(manifest.id)
        && (manifest.source === "builtin" || project.radio.enabledSkillIds.includes(manifest.id));
      return { manifest, enabled, approvedDigest: project.radio.approvedOrbitSkillDigests[manifest.id], compatibility, health: !enabled ? "disabled" : !approved ? "unapproved" : compatibility.compatible ? "ready" : "incompatible" };
    });
  }

  inspect(project: Project, skillId: string) {
    const record = this.discover(project).find((item) => item.manifest.id === skillId);
    if (!record) throw new Error("Skill is not available in this Orbit.");
    return record;
  }

  select(project: Project, coordinate: string, role: SpecialistRole) {
    const eligible = this.discover(project).filter((record) => record.enabled && record.health === "ready" && record.manifest.roles.includes(role));
    const coordinateMatches = eligible.filter((record) => record.manifest.coordinates.some((value) => value.toLowerCase() === coordinate.toLowerCase()));
    return (coordinateMatches.length ? coordinateMatches : eligible)
      .sort((left, right) => left.manifest.requiredAdapters.length - right.manifest.requiredAdapters.length || left.manifest.id.localeCompare(right.manifest.id));
  }

  compatibility(_project: Project, manifest: SkillManifest): SkillCompatibility {
    const reasons: string[] = [];
    if (!manifest.platforms.includes(process.platform as "linux" | "darwin" | "win32")) reasons.push(`Unsupported platform: ${process.platform}`);
    const adapters = new Set(CAPABILITY_ADAPTERS.filter((item) => item.available).map((item) => item.id));
    for (const adapter of manifest.requiredAdapters) if (!adapters.has(adapter)) reasons.push(`Adapter unavailable: ${adapter}`);
    return { skillId: manifest.id, compatible: reasons.length === 0, reasons };
  }

  private orbitSkills(project: Project): SkillManifest[] {
    if (!project.repositoryPath) return [];
    const root = realpathSync(project.repositoryPath);
    const skillsRoot = path.join(root, ".asteria", "skills");
    if (!existsSync(skillsRoot)) return [];
    const manifests: SkillManifest[] = [];
    for (const directory of readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      const manifestPath = path.join(skillsRoot, directory.name, "skill.json");
      if (!existsSync(manifestPath)) continue;
      const resolved = realpathSync(manifestPath);
      if (!resolved.startsWith(`${skillsRoot}${path.sep}`)) continue;
      const raw = readFileSync(resolved, "utf8");
      const parsed = OrbitSkillSchema.parse(JSON.parse(raw));
      if (parsed.id !== directory.name) throw new Error(`Orbit skill directory must match id: ${parsed.id}`);
      if (!parsed.roles.every((role) => roles.has(role))) throw new Error(`Orbit skill ${parsed.id} declares an unsupported role.`);
      const unsigned = { ...parsed, source: "orbit" as const };
      manifests.push({ ...unsigned, roles: parsed.roles as SpecialistRole[], integrity: createHash("sha256").update(raw).digest("hex") });
    }
    return manifests;
  }

  private assertAcyclic(manifests: SkillManifest[]) {
    const graph = new Map(manifests.map((item) => [item.id, item.dependencies]));
    const visiting = new Set<string>(); const visited = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) throw new Error(`Skill dependency cycle includes ${id}.`);
      if (visited.has(id)) return;
      visiting.add(id);
      for (const dependency of graph.get(id) ?? []) { if (!graph.has(dependency)) throw new Error(`Missing skill dependency: ${dependency}`); visit(dependency); }
      visiting.delete(id); visited.add(id);
    };
    for (const id of graph.keys()) visit(id);
  }
}
