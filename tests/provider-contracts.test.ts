import { describe, expect, it } from "vitest";
import { ProviderStreamNormalizer, normalizeEvent } from "../electron/providers";

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
