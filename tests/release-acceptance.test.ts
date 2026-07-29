import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("release acceptance gates", () => {
  const workflow = readFileSync(".github/workflows/release.yml", "utf8");
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as { build: { appId: string; productName: string; linux: { icon: string } } };
  it("never publishes automatically", () => {
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("--publish never");
    expect(workflow).not.toMatch(/electron-builder[^\n]*--publish (always|onTag)/);
  });
  it("keeps GitHub OAuth and platform signing credential gated", () => {
    expect(workflow).toContain("ASTERIA_GITHUB_CLIENT_ID");
    expect(workflow).toContain("APPLE_TEAM_ID");
    expect(workflow).toContain("WIN_CSC_LINK");
  });
  it("packages the Asteria identity and a concrete Linux icon source", () => {
    expect(manifest.build.appId).toBe("dev.asteria.desktop");
    expect(manifest.build.productName).toBe("Asteria");
    expect(manifest.build.linux.icon).toBe("build/icons/512x512/apps/asteria.png");
    for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
      expect(() => readFileSync(`build/icons/${size}x${size}/apps/asteria.png`)).not.toThrow();
    }
  });
});
