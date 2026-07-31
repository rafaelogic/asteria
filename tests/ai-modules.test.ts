import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DirectiveRegistry, ModelRouter, PromptComposer, parseDirective } from "../modules/shared/ai";
import { loadDirectiveRegistry } from "../modules/shared/electron-directives";
import { SPECIALIST_ROLES } from "../modules/stars/shared/catalog";
import { providerStartArgs } from "../electron/providers";

const directive = `---
id: test-identity
version: 1.0.0
module: stars
subject: qa
priority: 20
coordinates: [QA]
modelTier: balanced
requiredCapabilities: [structured-stream]
---
## Identity
I am the QA Star for this Orbit.
## Responsibilities
I verify behavior.
## Boundaries
I require evidence.
## Operating method
I run focused checks.
## Handoff
I report results to RaDio.`;

describe("Markdown directive registry", () => {
  it("loads complete developer-managed RaDio and Star directives", () => {
    const registry = loadDirectiveRegistry();
    expect(registry.list("radio").map((item) => item.metadata.id)).toEqual(expect.arrayContaining(["asteria-safety", "radio-identity"]));
    for (const role of SPECIALIST_ROLES) {
      expect(registry.list("stars").some((item) => item.metadata.subject === role), role).toBe(true);
    }
  });

  it("rejects malformed, unsafe, duplicate, and unknown-tier directives", () => {
    expect(() => parseDirective("no frontmatter")).toThrow(/frontmatter/);
    expect(() => parseDirective(directive.replace("balanced", "unbounded"))).toThrow(/unknown model tier/);
    expect(() => parseDirective(directive.replace("I am the QA Star", "You are RaDio"))).toThrow(/unsafe identity/);
    expect(() => new DirectiveRegistry([{ source: directive, name: "one" }, { source: directive.replace("1.0.0", "1.0.1"), name: "two" }])).toThrow(/Duplicate/);
    expect(() => parseDirective(directive.replace("## Handoff", "## Transfer"))).toThrow(/Handoff/);
  });

  it("composes prompts deterministically in policy-to-assignment order", () => {
    const identity = parseDirective(directive);
    const safety = parseDirective(directive.replace("test-identity", "safety").replace("module: stars", "module: radio").replace("subject: qa", "subject: radio").replace("priority: 20", "priority: 0").replace("I am the QA Star for this Orbit.", "I enforce the safety boundary."));
    const route = new ModelRouter({ codex: { balanced: "configured-balanced" } }).route({ provider: "codex", role: "qa", explicitTier: "balanced" });
    const first = new PromptComposer().compose({ safety, identity, skills: "skill", context: "context", assignment: "assignment", route });
    const second = new PromptComposer().compose({ safety, identity, skills: "skill", context: "context", assignment: "assignment", route });
    expect(first.prompt.indexOf(safety.body)).toBeLessThan(first.prompt.indexOf(identity.body));
    expect(first.prompt.indexOf(identity.body)).toBeLessThan(first.prompt.indexOf("## Activated skills"));
    expect(first.prompt.indexOf("## Activated skills")).toBeLessThan(first.prompt.indexOf("## Orbit context"));
    expect(first.manifest.promptDigest).toBe(second.manifest.promptDigest);
    expect(first.manifest.resolvedModel).toBe("configured-balanced");
  });
});

describe("provider-neutral model routing", () => {
  it("uses role tiers and escalates protected or repeated-failure work", () => {
    const router = new ModelRouter();
    expect(router.route({ provider: "codex", task: "classification" }).requestedTier).toBe("fast");
    expect(router.route({ provider: "claude", role: "frontend" }).requestedTier).toBe("balanced");
    const architect = router.route({ provider: "codex", role: "architect", explicitTier: "balanced" });
    expect(architect.requestedTier).toBe("frontier");
    expect(architect.blockedReason).toMatch(/configured frontier model/);
    expect(router.route({ provider: "codex", role: "frontend", repeatedFailures: 2 }).blockedReason).toMatch(/configured frontier model/);
    expect(router.route({ provider: "codex", role: "planner", explicitTier: "frontier" }).blockedReason).toMatch(/configured frontier model/);
    expect(new ModelRouter({ codex: { frontier: "configured-frontier" } }).route({ provider: "codex", role: "architect" }).blockedReason).toBeUndefined();
    const testFallback = new ModelRouter({}, { allowUnverifiedDefault: true }).route({ provider: "codex", role: "planner" });
    expect(testFallback.resolvedModel).toBe("provider-configured-default");
    expect(testFallback.fallbackHistory).not.toHaveLength(0);
  });

  it("passes configured models to provider CLIs without changing legacy defaults", () => {
    expect(providerStartArgs("codex", "work", { model: "configured-frontier" })).toContain("configured-frontier");
    expect(providerStartArgs("claude", "work", { model: "configured-balanced" })).toContain("configured-balanced");
    expect(providerStartArgs("codex", "work")).not.toContain("--model");
  });
});

describe("module boundaries", () => {
  it("routes the application shell through public RaDio and Stars entrypoints", () => {
    const main = readFileSync("electron/main.ts", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");
    expect(main).not.toContain('from "./radio/');
    expect(main).not.toContain('from "./stars/');
    expect(main).toContain("../modules/radio/index.js");
    expect(main).toContain("../modules/stars/index.js");
    expect(app).toContain("../modules/radio/renderer/index");
    expect(app).toContain("../modules/stars/renderer/index");
    expect(existsSync("src/radio.ts")).toBe(false);
    expect(existsSync("src/stars.ts")).toBe(false);
    expect(existsSync("electron/radio/core.ts")).toBe(false);
    expect(existsSync("electron/stars/core.ts")).toBe(false);
  });
});
