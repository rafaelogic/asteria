import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { maintenanceRequiresPreview, maintenanceRequiresSource, maintenanceUsesHostPreview } from "../modules/radio/electron/supervisor";
import { MaintenanceSendSchema, MaintenanceSourceSchema } from "../electron/contracts";
import { improveMaintenancePrompt } from "../src/screens/MaintenanceRadioScreen";

describe("Maintenance RaDio context", () => {
  it("renders the validated source version instead of a hardcoded release", () => {
    const screen = readFileSync("src/screens/MaintenanceRadioScreen.tsx", "utf8");
    expect(screen).toContain('state?.source?.version ?? "not selected"');
    expect(screen).not.toContain("/ 0.11.3");
  });
  it("keeps first-run activation available before a source is selected", () => {
    const screen = readFileSync("src/screens/MaintenanceRadioScreen.tsx", "utf8");
    expect(screen).toContain('state?.automation.lastCycleAt ? "Inspect now" : "Activate"');
    expect(screen).not.toContain('disabled={!state?.source || state?.automation.cycleRunning}');
  });
  it("maps operational state to a stable animated atmosphere", () => {
    const screen = readFileSync("src/screens/MaintenanceRadioScreen.tsx", "utf8");
    expect(screen).toContain("status-${visualState}");
    expect(screen).toContain("vibe-${vibeState}");
    expect(screen).toContain('data-vibe={vibeState}');
    expect(screen).toContain('className="neural-ai-atmosphere"');
  });
  it("keeps prompt submission available and routes enhancement through efficient Codex", () => {
    const screen = readFileSync("src/screens/MaintenanceRadioScreen.tsx", "utf8");
    const main = readFileSync("electron/main.ts", "utf8");
    expect(screen).not.toContain("!body.trim() || !readiness.ready || isStreaming");
    expect(screen).toContain("maintenance.improvePrompt");
    expect(main).toContain('model: "gpt-5.6-luna"');
    expect(main.match(/gpt-5\.6-sol/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("routes visual verification through the trusted host preview", () => {
    for (const request of ["verify the visual preview", "check the UI layout", "take a browser screenshot"]) {
      expect(maintenanceRequiresPreview(request)).toBe(true);
    }
    expect(maintenanceRequiresPreview("run the production build")).toBe(false);
    expect(maintenanceUsesHostPreview(true, "implement the requested changes and run the production build")).toBe(false);
    expect(maintenanceUsesHostPreview(true, "check the UI layout")).toBe(true);
    expect(maintenanceUsesHostPreview(false, "check the UI layout")).toBe(false);
  });

  it("allows application status and reports without source access", () => {
    expect(maintenanceRequiresSource("What is the installed version and rollback readiness?")).toBe(false);
    expect(maintenanceRequiresSource("Summarize current health incidents and reports")).toBe(false);
  });

  it("requests source just in time for code work", () => {
    for (const request of ["Analyze the Asteria code", "Fix the renderer", "Run tests and build the package", "Inspect the source repository"]) {
      expect(maintenanceRequiresSource(request)).toBe(true);
    }
  });

  it("requires stable operation and idempotency identifiers", () => {
    const operationId = "a4bde5a9-ef39-4fb5-9167-82420aa5482b";
    const base = { expectedVersion: 1, idempotencyKey: "maintenance_send_123", operationId };
    expect(MaintenanceSendSchema.safeParse({ ...base, body: "Show app health" }).success).toBe(true);
    expect(MaintenanceSourceSchema.safeParse({ ...base, source: "orbit", projectId: "project_1234" }).success).toBe(true);
    expect(MaintenanceSourceSchema.safeParse({ ...base, source: "folder" }).success).toBe(true);
  });

  it("improves maintenance prompts locally with scope and verification guidance", () => {
    expect(improveMaintenancePrompt("check the renderer")).toBe("Check the renderer. Inspect the relevant Asteria state first, preserve unrelated changes, and report the evidence from each verification.");
    expect(improveMaintenancePrompt("what is the current health")).toBe("Please explain what is the current health. Use the current application state and keep the response focused on Asteria maintenance.");
    expect(improveMaintenancePrompt("   ")).toBe("");
  });
});
