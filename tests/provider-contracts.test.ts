import { describe, expect, it } from "vitest";
import { ProviderStreamNormalizer, normalizeEvent, providerStartArgs } from "../electron/providers";

const cases = [
  { name: "message", input: '{"type":"message","content":"hello"}', type: "message" },
  { name: "reasoning", input: '{"type":"reasoning","content":"thinking"}', type: "reasoning" },
  { name: "tool", input: '{"type":"tool_result","content":"done"}', type: "tool_result" },
  { name: "malformed", input: '{"type":', type: "message" }
] as const;

describe.each(["codex", "claude"])("%s versioned provider contract fixture", () => {
  it.each(cases)("normalizes $name streams without leaking secrets", ({ input, type }) => {
    const event = normalizeEvent(input);
    expect(event.type).toBe(type);
    expect(normalizeEvent("sk-proj-secret-value").detail).not.toContain("sk-proj-secret-value");
  });
  it("reassembles partial JSON and flushes interrupted output", () => {
    const normalizer = new ProviderStreamNormalizer();
    expect(normalizer.push('{"type":"message",')).toEqual([]);
    expect(normalizer.push('"content":"fragment"}\n')).toHaveLength(1);
    normalizer.push("interrupted");
    expect(normalizer.flush()[0].detail).toBe("interrupted");
  });
});

describe("provider repository access arguments", () => {
  it("grants Codex workspace writes only when explicitly requested", () => {
    expect(providerStartArgs("codex", "fix it")).toEqual(["exec", "--json", "--sandbox", "read-only", "fix it"]);
    expect(providerStartArgs("codex", "fix it", { workspaceWrite: true })).toEqual(["exec", "--json", "--sandbox", "workspace-write", "fix it"]);
  });

  it("grants Claude edit acceptance only when explicitly requested", () => {
    expect(providerStartArgs("claude", "fix it")).toContain("plan");
    expect(providerStartArgs("claude", "fix it", { workspaceWrite: true })).toContain("acceptEdits");
  });
});

describe("provider response envelopes", () => {
  it("extracts Codex agent messages without exposing the raw JSON envelope", () => {
    const event = normalizeEvent(JSON.stringify({
      type: "item.completed",
      item: { id: "item_0", type: "agent_message", text: "Codex answer" },
    }));
    expect(event).toMatchObject({ type: "message", detail: "Codex answer" });
    expect(event.detail).not.toContain("item.completed");
  });

  it("extracts Claude content blocks as text", () => {
    const event = normalizeEvent(JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "Claude answer" }] },
    }));
    expect(event).toMatchObject({ type: "message", detail: "Claude answer" });
    expect(event.detail).not.toContain("[object Object]");
  });

  it("reduces non-visible progress envelopes to a bounded local event", () => {
    const event = normalizeEvent(JSON.stringify({ type: "thread.started", thread_id: "secret-internal-id" }));
    expect(event).toMatchObject({ type: "reasoning", detail: "thread.started" });
    expect(event.detail).not.toContain("secret-internal-id");
  });
});
