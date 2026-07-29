import type { Screen } from "./components/Sidebar";

export function isApplicationWorkspace(screen: Screen) {
  return screen === "maintenance-radio";
}

export function workspaceHistoryProjectId(screen: Screen, activeProjectId?: string) {
  return isApplicationWorkspace(screen) ? undefined : activeProjectId;
}
