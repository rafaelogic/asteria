import { describe, expect, it } from "vitest";
import { isApplicationWorkspace, workspaceHistoryProjectId } from "../src/workspace";

describe("application maintenance workspace", () => {
  it("keeps Maintenance RaDio outside Orbit-scoped navigation state", () => {
    expect(isApplicationWorkspace("maintenance-radio")).toBe(true);
    expect(workspaceHistoryProjectId("maintenance-radio", "orbit_1234")).toBeUndefined();
  });

  it("preserves project identity for Orbit workspaces", () => {
    expect(isApplicationWorkspace("workflow")).toBe(false);
    expect(workspaceHistoryProjectId("workflow", "orbit_1234")).toBe("orbit_1234");
  });
});
