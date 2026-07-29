import { describe, expect, it } from "vitest";
import { compactMaintenanceState } from "../electron/storage";
import type { ApplicationMaintenanceSettings } from "../src/types";

describe("maintenance history compaction", () => {
  it("bounds legacy message count and raw response size before rendering", () => {
    const now = new Date().toISOString();
    const messages = Array.from({ length: 130 }, (_, index) => ({
      id: `message_${index}`,
      author: "radio" as const,
      body: index === 129 ? "x".repeat(80 * 1024) : `message ${index}`,
      operationId: `operation_${index}`,
      status: "completed" as const,
      requiresSource: false,
      cards: [],
      createdAt: now,
      completedAt: now,
      redacted: true as const,
    }));
    const state: ApplicationMaintenanceSettings = {
      version: 1,
      provider: "codex",
      chat: { id: "maintenance", messages, createdAt: now, updatedAt: now },
      updatedAt: now,
    };
    const compacted = compactMaintenanceState(state);
    expect(compacted.chat.messages).toHaveLength(100);
    expect(compacted.chat.messages[0].id).toBe("message_30");
    expect(compacted.chat.messages.at(-1)?.body.length).toBeLessThan(70 * 1024);
    expect(compacted.chat.messages.at(-1)?.body).toContain("truncated");
  });
});
