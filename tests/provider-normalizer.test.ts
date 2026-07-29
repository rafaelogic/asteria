import { describe, expect, it } from "vitest";
import { ProviderStreamNormalizer } from "../electron/providers";

describe("provider stream normalizer", () => {
  it("buffers partial JSONL records", () => {
    const normalizer = new ProviderStreamNormalizer();
    expect(normalizer.push('{"type":"message","text":"hel')).toEqual([]);
    const events = normalizer.push('lo"}\n');
    expect(events).toHaveLength(1);
    expect(events[0].detail).toBe("hello");
  });

  it("preserves malformed output as a redacted local event", () => {
    const normalizer = new ProviderStreamNormalizer();
    const events = normalizer.push(`tool said api_key=${"x".repeat(24)}\n`);
    expect(events[0].detail).toContain("[REDACTED]");
  });
});
