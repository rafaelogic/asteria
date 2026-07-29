import { describe, expect, it } from "vitest";
import { maintenanceRequiresSource } from "../electron/radio/supervisor";
import { MaintenanceSendSchema, MaintenanceSourceSchema } from "../electron/contracts";

describe("Maintenance RaDio context", () => {
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
});
