import { describe, expect, it } from "vitest";
import { decideNetworkRequest } from "../electron/network-policy";

describe("network policy", () => {
  it("permanently denies creator analytics", () => {
    expect(decideNetworkRequest("https://frugpmstpnojnhfyimgv.supabase.co/rest/v1/events").decision).toBe("deny");
    expect(decideNetworkRequest("https://telemetry.asteria.invalid/events").decision).toBe("deny");
  });

  it("does not provide an Asteria telemetry collector destination", () => {
    expect(decideNetworkRequest("https://example.com/asteria/telemetry").decision).toBe("deny");
  });

  it.each([
    "http://undeclared.example/path",
    "https://undeclared.example/redirect",
    "ws://undeclared.example/socket",
    "wss://undeclared.example/socket",
    "ftp://undeclared.example/file"
  ])("fails closed for undeclared direct, redirect, websocket, and alternate protocol destinations", (url) => {
    expect(decideNetworkRequest(url).decision).toBe("review");
  });

  it("does not let an allowed host hide a telemetry path", () => {
    expect(decideNetworkRequest("https://api.github.com/analytics/collect").decision).toBe("deny");
  });
});
