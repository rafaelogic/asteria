import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SkillRegistry } from "../electron/radio/skills/registry";
import { SkillRuntime } from "../electron/radio/skills/runtime";
import { DEFAULT_RADIO_SETTINGS } from "../src/radio";
import { validateAdapterInvocation } from "../electron/radio/skills/policy";
import type { Project } from "../src/types";

function project(repositoryPath?: string): Project {
  const now = new Date().toISOString();
  return {
    id: "project_skills", version: 1, name: "Skill Orbit", repository: "local", repositoryPath,
    objective: "Verify RaDio skills", visibility: "Local", provider: "codex", runId: "run_skills", runStatus: "active",
    workflow: [], currentAction: { title: "", detail: "", milestone: "", tool: "", elapsed: "" }, events: [], tasks: [],
    messages: [], artifacts: [], approvals: [], radio: { ...DEFAULT_RADIO_SETTINGS }, ideas: [], accountTransitions: [],
    radioReports: [], skillExecutions: [], budget: { minutes: 60, usedMinutes: 0, tokenLimit: 1000, usedTokens: 0 },
    createdAt: now, updatedAt: now
  };
}

describe("RaDio skills registry", () => {
  it("ships the complete trusted built-in catalog", () => {
    const records = new SkillRegistry().discover(project());
    expect(records).toHaveLength(18);
    expect(records.find((item) => item.manifest.id === "repository-manager")).toMatchObject({ enabled: true, health: "ready" });
    expect(new Set(records.map((item) => item.manifest.integrity)).size).toBe(records.length);
  });

  it("requires an exact digest before enabling an Orbit recipe", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "asteria-orbit-skill-"));
    const directory = path.join(root, ".asteria", "skills", "orbit-helper");
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, "skill.json"), JSON.stringify({
      schemaVersion: 1, id: "orbit-helper", name: "Orbit Helper", version: "1.0.0", description: "Reads project conventions.",
      roles: ["planner"], coordinates: ["Define"], providers: ["codex"], platforms: [process.platform],
      requiredCapabilities: ["filesystem"], requiredAdapters: ["filesystem"], dependencies: [], risk: "read",
      permissions: ["filesystem_read"], instructions: "Read project conventions."
    }));
    const registry = new SkillRegistry();
    const initial = registry.inspect(project(root), "orbit-helper");
    expect(initial.health).toBe("disabled");
    const approved = project(root);
    approved.radio.enabledSkillIds = ["orbit-helper"];
    approved.radio.approvedOrbitSkillDigests = { "orbit-helper": initial.manifest.integrity };
    expect(registry.inspect(approved, "orbit-helper").health).toBe("ready");
  });

  it("blocks production-risk skills without production authority", () => {
    const current = project();
    const runtime = new SkillRuntime(new SkillRegistry());
    const executions = runtime.prepare(current, "Production Gate", "devops", "operation-1", "codex");
    expect(executions.some((item) => item.skillId === "production-gatekeeper" && item.status === "blocked")).toBe(true);
  });

  it("does not activate disabled skills", () => {
    const current = project();
    current.radio.disabledSkillIds = ["planner"];
    const runtime = new SkillRuntime(new SkillRegistry());
    expect(runtime.prepare(current, "Define", "planner", "operation-2").some((item) => item.skillId === "planner")).toBe(false);
  });

  it("rejects undeclared adapters and worktrees outside the Orbit", () => {
    const current = project("/tmp");
    const manifest = new SkillRegistry().inspect(current, "repository-manager").manifest;
    expect(validateAdapterInvocation(current, manifest, { operationId: "operation_123", adapterId: "deployment", operation: "deploy", environment: "staging" }).decision).toBe("deny");
    expect(validateAdapterInvocation(current, manifest, { operationId: "operation_124", adapterId: "git", operation: "status", environment: "workspace", worktreePath: "/var/another" }).decision).toBe("deny");
  });
});
