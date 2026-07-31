import type { ApplicationMaintenanceSettings, UserInstallState } from "../../../src/types.js";

function isNewerVersion(current?: string, expected?: string) {
  const parse = (value?: string) => value?.match(/^(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number);
  const left = parse(current);
  const right = parse(expected);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return false;
}

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
  const supersededByHealthyRelease = isNewerVersion(installed.currentVersion, pending.install.version)
    && installed.health?.heartbeat === true
    && installed.health.storage === true
    && installed.health.providers === true
    && installed.health.skills === true
    && installed.health.renderer === true
    && installed.health.consoleErrors.length === 0;
  const released = healthy || supersededByHealthyRelease;
  return {
    ...state,
    activeGoalId: state.activeGoalId === pending.id ? undefined : state.activeGoalId,
    goals: state.goals.map((goal) => goal.id !== pending.id ? goal : {
      ...goal,
      status: released ? "completed" as const : "blocked" as const,
      currentAction: healthy ? "Self-update activated; continuing from the verified Waypoint" : supersededByHealthyRelease ? `Superseded by verified Asteria ${installed.currentVersion}` : "Self-update health evidence did not match the promoted revision",
      blocker: released ? undefined : `Expected healthy Asteria ${pending.install?.version}; active version is ${installed.currentVersion ?? "unknown"}.`,
      install: { ...pending.install!, status: released ? "healthy" as const : "blocked" as const, completedAt: now },
      completedAt: released ? now : undefined,
      updatedAt: now,
    }),
    automation: {
      ...state.automation,
      status: released ? "idle" as const : "blocked" as const,
      idleStatus: healthy ? "Self-update verified; reviewing the next goal" : supersededByHealthyRelease ? `Newer healthy release ${installed.currentVersion} verified; reviewing the next goal` : state.automation.idleStatus,
    },
    updatedAt: now,
  };
}
