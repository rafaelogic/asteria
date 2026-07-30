import { describe, expect, it } from "vitest";
import { reconcileMaintenanceRelaunch } from "../electron/radio/maintenance-update";
import type { ApplicationMaintenanceSettings } from "../src/types";

const state = {
  version: 1,
  provider: "codex",
  chat: { id: "chat", messages: [], createdAt: "", updatedAt: "" },
  automation: { enabled: true, autoInstall: true, paused: false, emergencyStopped: false, startupInspection: true, intervalMinutes: 30, dailyFeatureLimit: 1, cycleRunning: false, status: "relaunching", idleStatus: "" },
  goals: [{ id: "goal", type: "feature", title: "Update", rationale: "", priority: 1, status: "relaunching", currentAction: "", assignedStar: "RaDio", attempts: 1, sourceEvidence: [], findings: [], install: { status: "relaunching", version: "0.12.0", commit: "abc", startedAt: "" }, createdAt: "", updatedAt: "" }],
  activeGoalId: "goal",
  findings: [],
  updatedAt: "",
} satisfies ApplicationMaintenanceSettings;

describe("maintenance self-update continuation", () => {
  it("completes only after the expected installed version passes health checks", () => {
    const resumed = reconcileMaintenanceRelaunch(state, { currentVersion: "0.12.0", rollbackReady: true, manifest: { schemaVersion: 1, version: "0.12.0", commit: "abc", sourceDigest: "abc", artifactDigest: "digest", checks: [], createdAt: "" }, health: { storage: true, providers: true, skills: true, renderer: true, consoleErrors: [], heartbeat: true, checkedAt: "" } }, "now");
    expect(resumed.goals[0].status).toBe("completed");
    expect(resumed.goals[0].install?.status).toBe("healthy");
    expect(resumed.activeGoalId).toBeUndefined();
  });

  it("blocks on a version or health mismatch", () => {
    const resumed = reconcileMaintenanceRelaunch(state, { currentVersion: "0.11.8", rollbackReady: true }, "now");
    expect(resumed.goals[0].status).toBe("blocked");
    expect(resumed.goals[0].install?.status).toBe("blocked");
    expect(resumed.goals[0].blocker).toContain("Expected healthy Asteria 0.12.0");
  });
});
