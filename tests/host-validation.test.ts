import { describe, expect, it } from "vitest";
import { validationChecksForMaintenance } from "../electron/radio/validation-manager";

describe("trusted host validation routing", () => {
  it("runs the fixed full validation set for source-changing maintenance work", () => {
    expect(validationChecksForMaintenance(true, "implement the fix, test it, and commit changes")).toEqual([
      "unit", "typecheck", "build", "sites", "release"
    ]);
  });

  it("does not grant host execution without a validated source or for discussion", () => {
    expect(validationChecksForMaintenance(false, "implement the fix")).toEqual([]);
    expect(validationChecksForMaintenance(true, "explain what this error means")).toEqual([]);
  });
});
