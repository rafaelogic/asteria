import { mkdtemp, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectAttachment, revalidateAttachment } from "../modules/radio/electron/attachments";
import {
  classifyChatCommand,
  classifyHealth,
  decideChatCommand,
  healthFingerprint,
  recordIncident,
} from "../modules/radio/electron/supervisor";
import {
  buildDelegation,
  createExecutionProposal,
  normalizeRadioContinuity,
} from "../modules/radio/shared/behavior";
import { projects } from "../src/data";

describe("RaDio supervisor", () => {
  it("classifies genuine failures and routes them to the owning Star", () => {
    expect(classifyHealth("renderer", "render", "React component crashed")).toBe("renderer");
    expect(classifyHealth("storage", "open", "encrypted database is locked")).toBe("storage");
    const project = {
      ...projects[0],
      radio: { ...projects[0].radio, mode: "full_autonomous" as const },
      incidents: [],
    };
    const incidents = recordIncident(project, {
      source: "renderer",
      operation: "render",
      message: "React component crashed",
    });
    expect(incidents[0].owner).toBe("frontend");
    expect(incidents[0].status).toBe("repairing");
  });

  it("deduplicates normalized evidence across restarts", () => {
    expect(healthFingerprint("build", "vite", "compile", "failed in 123 ms")).toBe(
      healthFingerprint("build", "vite", "compile", "failed in 987 ms"),
    );
  });

  it("denies privileged and protected-branch chat commands", () => {
    for (const text of ["run sudo apt install", "push directly to main", "write /etc/asteria"]) {
      expect(decideChatCommand(projects[0], classifyChatCommand(text)).status).toBe("denied");
    }
  });

  it("uses a typed, risk-scaled lifecycle for actionable chat", () => {
    const command = decideChatCommand(projects[0], classifyChatCommand("implement the settings validation"));
    expect(command.intent).toBe("execute");
    expect(command.risk).toBe("workspace_write");
    expect(command.behaviorStates).toEqual(expect.arrayContaining(["understand", "preflight", "execute", "verify", "checkpoint"]));
    expect(command.status).toBe("allowed");
  });

  it("deduplicates Star activation and assigns independent high-risk verification", () => {
    expect(buildDelegation({ role: "frontend", assignment: "Repair the renderer", rationale: "Owns the failure", risk: "workspace_write", activeRoles: ["frontend"] })).toBeUndefined();
    const delegation = buildDelegation({ role: "backend", assignment: "Repair production integration", rationale: "Owns the boundary", risk: "external_mutation" });
    expect(delegation?.independentVerifier).toBe("qa");
    const proposal = createExecutionProposal({ operation: "deploy the verified service", risk: "external_mutation", delegations: delegation ? [delegation, delegation] : [] });
    expect(proposal.planningStyle).toBe("authorization_required");
    expect(proposal.delegations).toHaveLength(1);
  });

  it("normalizes legacy Orbit continuity without losing its objective", () => {
    const continuity = normalizeRadioContinuity({ id: "legacy-orbit", objective: "Preserve this objective" });
    expect(continuity.currentObjective).toBe("Preserve this objective");
    expect(continuity.behaviorState).toBe("understand");
    expect(continuity.evidence).toEqual([]);
  });

  it("keeps Ascendant from auto-approving human workflow gates", () => {
    const main = readFileSync("electron/main.ts", "utf8");
    expect(main).not.toContain("takeover_gate_${project.runId}");
    expect(main).toContain("A focused human authorization gate is pending.");
  });
});

describe("RaDio chat attachments", () => {
  it("accepts selected text files and detects subsequent changes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "asteria-attachment-"));
    const file = path.join(root, "evidence.md");
    await writeFile(file, "# Evidence\n");
    const attachment = await inspectAttachment(file);
    expect(attachment.status).toBe("ready");
    await writeFile(file, "# Changed\n");
    expect((await revalidateAttachment(attachment)).status).toBe("stale");
  });

  it("rejects executable binary formats", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "asteria-attachment-"));
    const file = path.join(root, "payload.exe");
    await writeFile(file, "MZ");
    expect((await inspectAttachment(file)).status).toBe("rejected");
  });
});
