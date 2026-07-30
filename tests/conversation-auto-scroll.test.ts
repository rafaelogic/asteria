import { describe, expect, it } from "vitest";
import { isNearScrollBottom } from "../src/hooks/useConversationAutoScroll";

describe("conversation auto-scroll", () => {
  it("keeps following messages while the reader is near the bottom", () => {
    expect(isNearScrollBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 540 })).toBe(true);
  });

  it("stops following messages after the reader scrolls up", () => {
    expect(isNearScrollBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 300 })).toBe(false);
  });
});
