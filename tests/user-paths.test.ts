import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveUserPath, sanitizedDesktopEnvironment } from "../scripts/user-paths.mjs";

describe("user-local release paths", () => {
  const home = path.join(path.sep, "home", "rafael");

  it("rejects XDG paths inherited from a confined Snap process", () => {
    const environment = { XDG_DATA_HOME: path.join(home, "snap", "code", "253", ".local", "share") };
    expect(resolveUserPath("XDG_DATA_HOME", [".local", "share"], environment, home)).toBe(path.join(home, ".local", "share"));
    expect(sanitizedDesktopEnvironment(environment, home).XDG_DATA_HOME).toBeUndefined();
  });

  it("preserves an explicitly configured non-Snap XDG path", () => {
    const environment = { XDG_DATA_HOME: path.join(home, "xdg", "data") };
    expect(resolveUserPath("XDG_DATA_HOME", [".local", "share"], environment, home)).toBe(environment.XDG_DATA_HOME);
    expect(sanitizedDesktopEnvironment(environment, home).XDG_DATA_HOME).toBe(environment.XDG_DATA_HOME);
  });
});
