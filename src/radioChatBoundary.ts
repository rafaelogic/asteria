import type { Project } from "./types";

export interface RadioChatSendInput {
  projectId: string;
  runId: string;
  expectedVersion: number;
  idempotencyKey: string;
  body: string;
  references: Array<{ kind: "coordinate" | "incident" | "task" | "file" | "commit" | "observation" | "star"; id: string; label: string }>;
  attachmentIds: string[];
}

export async function sendRadioChatWithFreshBoundary(
  input: RadioChatSendInput,
  send: (candidate: RadioChatSendInput) => Promise<Project>,
  list: () => Promise<Project[]>,
) {
  try {
    return await send(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Chat (?:state changed|project boundary mismatch)/i.test(message)) throw error;
    const latest = (await list()).find((project) => project.id === input.projectId);
    if (!latest || latest.runId !== input.runId || !latest.repositoryPath || latest.version === input.expectedVersion) throw error;
    return await send({ ...input, expectedVersion: latest.version, idempotencyKey: `${input.idempotencyKey}_refresh` });
  }
}
