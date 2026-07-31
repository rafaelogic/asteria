import type { ApplicationMaintenanceSettings, UserInstallState } from "../../../src/types.js";

export function reconcileMaintenanceRelaunch(
  state: ApplicationMaintenanceSettings,
  installed: UserInstallState,
  now = new Date().toISOString()
) {
  const pending = state.goals.find((goal) => goal.status === "relaunching" && goal.install);
  if (!pending?.install) return state;
  const healthy = installed.currentVersion === pending.install.version
    && installed.manifest?.commit === pending.install.commit
    && installed.health?.heartbeat === true
    && installed.health.storage === true
    && installed.health.providers === true
    && installed.health.skills === true
    && installed.health.renderer === true
    && installed.health.consoleErrors.length === 0;
  return {
    ...state,
    activeGoalId: state.activeGoalId === pending.id ? undefined : state.activeGoalId,
    goals: state.goals.map((goal) => goal.id !== pending.id ? goal : {
      ...goal,
      status: healthy ? "completed" as const : "blocked" as const,
      currentAction: healthy ? "Self-update activated; continuing from the verified Waypoint" : "Self-update health evidence did not match the promoted revision",
      blocker: healthy ? undefined : `Expected healthy Asteria ${pending.install?.version}; active version is ${installed.currentVersion ?? "unknown"}.`,
      install: { ...pending.install!, status: healthy ? "healthy" as const : "blocked" as const, completedAt: now },
      completedAt: healthy ? now : undefined,
      updatedAt: now,
    }),
    automation: {
      ...state.automation,
      status: healthy ? "idle" as const : "blocked" as const,
      idleStatus: healthy ? "Self-update verified; reviewing the next goal" : state.automation.idleStatus,
    },
    updatedAt: now,
  };
}
