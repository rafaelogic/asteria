import { describe, expect, it } from "vitest";
import { DEFAULT_RADIO_SETTINGS, RADIO_GOVERNING_PROMPT, accountCanRun, radioPolicyDecision, selectApplicationRaDioAccount, selectRaDioAccount } from "../src/radio";
import type { ProviderAccountProfile } from "../src/types";

function account(input: Partial<ProviderAccountProfile> & Pick<ProviderAccountProfile, "id" | "provider">): ProviderAccountProfile {
  return {
    nickname: input.id, enabled: true, order: 0, authenticated: true,
    capabilities: ["structured-stream", "cancellation", "isolated-home", "tool-events"],
    health: "healthy", usage: { remainingPercent: 50, source: "provider", capturedAt: new Date().toISOString() },
    activeSessions: 0, concurrencyLimit: 1, failureRate: 0, allowedProjectIds: [], allowedRoles: [], ...input
  };
}

describe("RaDio account routing", () => {
  it("selects the compatible account with the most authoritative remaining capacity", () => {
    const profiles = [account({ id: "codex-low", provider: "codex", usage: { remainingPercent: 20, source: "provider", capturedAt: "" } }), account({ id: "claude-high", provider: "claude", usage: { remainingPercent: 80, source: "provider", capturedAt: "" } })];
    const selected = selectRaDioAccount(profiles, { enabled: true, thresholdPercent: 5, crossProvider: true, accountIds: profiles.map((item) => item.id) }, "asteria", "planner", ["structured-stream"]);
    expect(selected?.id).toBe("claude-high");
  });

  it("does not start work on an account at the five-percent threshold", () => {
    expect(accountCanRun(account({ id: "draining", provider: "codex", usage: { remainingPercent: 5, source: "provider", capturedAt: "" } }), "asteria", "planner", [])).toBe(false);
  });

  it("does not fabricate unavailable usage", () => {
    expect(accountCanRun(account({ id: "unknown", provider: "codex", usage: { source: "unavailable", capturedAt: "" } }), "asteria", "planner", [])).toBe(true);
  });

  it("routes application maintenance through an authenticated account profile", () => {
    const profiles = [
      account({ id: "legacy-claim", provider: "codex", authenticated: false }),
      account({ id: "codex-connected", provider: "codex", authenticated: true }),
      account({ id: "claude-connected", provider: "claude", authenticated: true })
    ];
    expect(selectApplicationRaDioAccount(profiles, "codex", ["structured-stream"])?.id).toBe("codex-connected");
  });
});

describe("RaDio safety policy", () => {
  it("requires recovery from patch drift and evidence before reusing a preview", () => {
    expect(RADIO_GOVERNING_PROMPT).toContain("reread the current target region");
    expect(RADIO_GOVERNING_PROMPT).toContain("Never start or probe a localhost preview listener from a provider sandbox");
    expect(RADIO_GOVERNING_PROMPT).toContain("report build success and visual verification separately");
  });

  it("always gates destructive live production data operations", () => {
    expect(radioPolicyDecision({ settings: { ...DEFAULT_RADIO_SETTINGS, mode: "full_autonomous", mergeProductionEnabled: true }, risk: "destructive", operation: "truncate customer table", environment: "production" }).decision).toBe("approval");
  });

  it("denies direct pushes to main and master", () => {
    expect(radioPolicyDecision({ settings: { ...DEFAULT_RADIO_SETTINGS, mode: "full_autonomous" }, risk: "external_mutation", operation: "git push", branch: "main" }).decision).toBe("deny");
  });

  it("gates external mutations in autonomous mode", () => {
    expect(radioPolicyDecision({ settings: DEFAULT_RADIO_SETTINGS, risk: "external_mutation", operation: "create pull request" }).decision).toBe("approval");
  });
});
