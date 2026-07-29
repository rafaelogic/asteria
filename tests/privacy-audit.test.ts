import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Asteria privacy audit", () => {
  it("finds no remote analytics or hard-coded upload path", () => {
    const report = JSON.parse(
      readFileSync(path.join(process.cwd(), "runtime", "privacy-audit.json"), "utf8")
    );
    expect(report.application).toBe("Asteria");
    expect(report.localOnly).toBe(true);
    expect(report.status).toBe("passed");
    expect(report.findings).toBe(0);
  });
});
