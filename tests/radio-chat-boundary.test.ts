import { describe, expect, it, vi } from "vitest";
import { sendRadioChatWithFreshBoundary, type RadioChatSendInput } from "../src/radioChatBoundary";
import type { Project } from "../src/types";

const input: RadioChatSendInput = {
  projectId: "orbit_test",
  runId: "run_test",
  expectedVersion: 4,
  idempotencyKey: "radio_chat_test",
  body: "Review the current state",
  references: [],
  attachmentIds: [],
};

function project(version: number, runId = input.runId) {
  return { id: input.projectId, runId, version, repositoryPath: "/tmp/orbit" } as Project;
}

describe("RaDio chat boundary refresh", () => {
  it("retries once with the latest version when the same Orbit run changed while composing", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error("Chat state changed while composing. Refreshing the Orbit is required."))
      .mockResolvedValueOnce(project(5));
    const result = await sendRadioChatWithFreshBoundary(input, send, async () => [project(5)]);
    expect(result.version).toBe(5);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ expectedVersion: 5, idempotencyKey: "radio_chat_test_refresh" }));
  });

  it("never retries across a changed run boundary", async () => {
    const error = new Error("Chat project boundary mismatch.");
    const send = vi.fn().mockRejectedValue(error);
    await expect(sendRadioChatWithFreshBoundary(input, send, async () => [project(5, "run_new")])).rejects.toBe(error);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
