import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("desktop security regression", () => {
  it("ships a restrictive renderer CSP", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("object-src 'none'");
    const main = readFileSync("electron/main.ts", "utf8");
    expect(main).toContain("frame-ancestors 'none'");
  });

  it("contains no remote analytics dependency", () => {
    const manifest = readFileSync("package.json", "utf8");
    expect(manifest).not.toMatch(/segment|mixpanel|amplitude|posthog|sentry/i);
  });
});
