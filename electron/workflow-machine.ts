import { assign, setup } from "xstate";

export const workflowMachine = setup({
  types: {
    context: {} as { runId: string; currentStep: number; error?: string },
    input: {} as { runId: string },
    events: {} as
      | { type: "START" }
      | { type: "STEP_COMPLETED" }
      | { type: "APPROVAL_REQUIRED" }
      | { type: "APPROVED" }
      | { type: "PAUSE" }
      | { type: "RESUME" }
      | { type: "FAIL"; error: string }
  },
  actions: {
    advance: assign({ currentStep: ({ context }) => context.currentStep + 1 }),
    recordError: assign({ error: ({ event }) => event.type === "FAIL" ? event.error : undefined })
  },
  guards: {
    hasMoreSteps: ({ context }) => context.currentStep < 6
  }
}).createMachine({
  id: "asteria-workflow",
  initial: "idle",
  context: ({ input }) => ({ runId: input.runId, currentStep: 0 }),
  states: {
    idle: { on: { START: "running" } },
    running: {
      on: {
        STEP_COMPLETED: [
          { guard: "hasMoreSteps", actions: "advance", target: "running", reenter: true },
          { target: "completed" }
        ],
        APPROVAL_REQUIRED: "approval",
        PAUSE: "paused",
        FAIL: { actions: "recordError", target: "failed" }
      }
    },
    approval: { on: { APPROVED: "running", PAUSE: "paused" } },
    paused: { on: { RESUME: "running" } },
    failed: { type: "final" },
    completed: { type: "final" }
  }
});
