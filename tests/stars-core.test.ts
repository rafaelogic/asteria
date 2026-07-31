import { describe, expect, it } from "vitest";
import { StarCore } from "../modules/stars/electron/core";
import { StarsModule } from "../modules/stars/electron/module";
import { SPECIALIST_ROLES, STAR_CATALOG, emptyStarContinuity, normalizeStarContinuity, starForIncident, validateStarCatalog } from "../modules/stars/shared/catalog";
import { loadDirectiveRegistry } from "../modules/shared/electron-directives";
import { ModelRouter } from "../modules/shared/ai";
import type { Project, StarDefinition } from "../src/types";

function project(overrides: Partial<Project> = {}) {
  return {
    id: "orbit-one",
    name: "Identity",
    objective: "Give every Star a durable voice",
    constraints: "Preserve provider neutrality",
    provider: "codex",
    roleProviders: {},
    starContinuity: emptyStarContinuity("orbit-one"),
    ...overrides,
  } as Project;
}

describe("Stars catalog", () => {
  it("has exactly one validated definition for every supported role", () => {
    expect(STAR_CATALOG.map((star) => star.id).sort()).toEqual([...SPECIALIST_ROLES].sort());
    expect(new Set(STAR_CATALOG.map((star) => star.id)).size).toBe(SPECIALIST_ROLES.length);
  });

  it("rejects duplicate, missing, unsupported, and unsafe identities", () => {
    const catalog = structuredClone(STAR_CATALOG) as StarDefinition[];
    expect(() => validateStarCatalog([...catalog, catalog[0]])).toThrow(/Duplicate/);
    expect(() => validateStarCatalog(catalog.slice(1))).toThrow(/missing roles/i);
    expect(() => validateStarCatalog(catalog.map((star, index) => index ? star : { ...star, id: "wizard" }))).toThrow(/Unsupported/);
  });

  it("uses catalog-owned incident routing", () => {
    expect(starForIncident("renderer")).toBe("frontend");
    expect(starForIncident("test")).toBe("qa");
    expect(starForIncident("unknown")).toBe("architect");
  });
});

describe("StarCore identity", () => {
  it("builds a first-person Star prompt without inheriting RaDio identity", () => {
    const prompt = new StarsModule(loadDirectiveRegistry(), new ModelRouter()).composeAssignment(project(), "qa", {
      provider: "codex",
      coordinate: "QA",
      objective: "Verify the identity boundary",
    }).prompt;
    expect(prompt).toContain("I am the QA Star for this Orbit.");
    expect(prompt).toContain("Stable identity: orbit-one:qa");
    expect(prompt).not.toContain("You are RaDio");
    expect(prompt).not.toMatch(/I am (?:Codex|Claude)/);
  });

  it("retains the same identity while provider Relay metadata changes", () => {
    const core = new StarCore();
    const initial = project();
    const codexContinuity = core.beginAssignment(initial, "frontend", "Build the UI", "codex");
    const relayed = project({ starContinuity: codexContinuity });
    const claudeContinuity = core.beginAssignment(relayed, "frontend", "Continue the UI", "claude");
    expect(claudeContinuity.frontend?.identity.id).toBe(codexContinuity.frontend?.identity.id);
    expect(claudeContinuity.frontend?.provider).toBe("claude");
    expect(new StarsModule(loadDirectiveRegistry(), new ModelRouter()).composeAssignment(project({ starContinuity: claudeContinuity }), "frontend", {
      provider: "claude",
      coordinate: "Frontend",
      objective: "Continue",
    }).prompt).toContain("Previous assignment: Continue the UI");
  });

  it("normalizes legacy Orbits without replacing existing continuity", () => {
    const legacy = project({ starContinuity: undefined });
    const normalized = normalizeStarContinuity(legacy);
    expect(normalized.planner?.identity.id).toBe("orbit-one:planner");
    const existing = coreContinuityWithDecision();
    expect(normalizeStarContinuity(project({ starContinuity: existing })).planner?.decisions).toEqual(["Keep the public API stable"]);
  });
});

function coreContinuityWithDecision() {
  const continuity = emptyStarContinuity("orbit-one");
  continuity.planner = { ...continuity.planner!, decisions: ["Keep the public API stable"] };
  return continuity;
}
