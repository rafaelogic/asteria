import { describe, expect, it } from "vitest";
import path from "node:path";

describe("session isolation contract", () => {
  it("keeps generated provider homes below app-owned session data", () => {
    const appData = path.join("/tmp", "asteria-test");
    const session = path.join(appData, "sessions", "run_1234");
    expect(path.relative(appData, path.join(session, "home", "codex", ".codex"))).not.toMatch(/^\.\./);
    expect(path.relative(appData, path.join(session, "home", "claude", ".claude"))).not.toMatch(/^\.\./);
  });
});
