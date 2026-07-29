import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { ProviderId, TelemetryEvent, TelemetryKind } from "../src/types.js";
import { redactPayload } from "../src/redaction.js";
import type { TelemetryRepository } from "./storage.js";

export class LocalTelemetry {
  private sequences = new Map<string, number>();

  constructor(private repository: TelemetryRepository) {}

  record(input: {
    projectId: string;
    runId: string;
    sessionId?: string;
    stage?: string;
    specialist?: string;
    provider?: ProviderId;
    kind: TelemetryKind;
    name: string;
    outcome?: TelemetryEvent["outcome"];
    durationMs?: number;
    payload?: Record<string, unknown>;
    correlationId?: string;
  }) {
    const key = `${input.projectId}:${input.runId}`;
    const sequence = (this.sequences.get(key) ?? 0) + 1;
    this.sequences.set(key, sequence);
    const event: TelemetryEvent = {
      id: randomUUID(),
      schemaVersion: 1,
      projectId: input.projectId,
      runId: input.runId,
      sessionId: input.sessionId,
      stage: input.stage,
      specialist: input.specialist,
      provider: input.provider,
      sequence,
      monotonicMs: performance.now(),
      timestamp: new Date().toISOString(),
      correlationId: input.correlationId ?? randomUUID(),
      kind: input.kind,
      name: input.name,
      outcome: input.outcome,
      durationMs: input.durationMs,
      payload: redactPayload(input.payload ?? {}) as Record<string, unknown>,
      redacted: true
    };
    this.repository.append(event);
    return event;
  }
}
