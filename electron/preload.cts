import { contextBridge, ipcRenderer } from "electron";
import type { AgentEvent, AsteriaApi } from "../src/types.js";

const api: AsteriaApi = {
  projects: {
    list: () => ipcRenderer.invoke("projects:list"),
    create: (draft) => ipcRenderer.invoke("projects:create", draft),
    update: (input) => ipcRenderer.invoke("projects:update", input),
    subscribe(listener) {
      const handler = (_event: Electron.IpcRendererEvent, project: Parameters<typeof listener>[0]) => listener(project);
      ipcRenderer.on("project:updated", handler);
      return () => ipcRenderer.removeListener("project:updated", handler);
    }
  },
  providers: {
    detect: () => ipcRenderer.invoke("providers:detect"),
    contracts: () => ipcRenderer.invoke("providers:contracts"),
    authState: (provider) => ipcRenderer.invoke("providers:auth-state", provider),
    authenticate: (provider) => ipcRenderer.invoke("providers:authenticate", provider),
    start: (input) => ipcRenderer.invoke("providers:start", input),
    cancel: (sessionId) => ipcRenderer.invoke("providers:cancel", sessionId)
  },
  accounts: {
    list: () => ipcRenderer.invoke("accounts:list"),
    add: (input) => ipcRenderer.invoke("accounts:add", input),
    authenticate: (profileId) => ipcRenderer.invoke("accounts:authenticate", profileId),
    update: (input) => ipcRenderer.invoke("accounts:update", input),
    remove: (profileId) => ipcRenderer.invoke("accounts:remove", profileId),
    refreshUsage: (profileId) => ipcRenderer.invoke("accounts:refresh-usage", profileId)
  },
  radio: {
    updateSettings: (input) => ipcRenderer.invoke("radio:update-settings", input),
    scout: (input) => ipcRenderer.invoke("radio:scout", input),
    updateIdea: (input) => ipcRenderer.invoke("radio:update-idea", input),
    safeHandoff: (input) => ipcRenderer.invoke("radio:safe-handoff", input),
    emergencyStop: (input) => ipcRenderer.invoke("radio:emergency-stop", input)
  },
  skills: {
    list: (projectId) => ipcRenderer.invoke("skills:list", projectId),
    inspect: (projectId, skillId) => ipcRenderer.invoke("skills:inspect", { projectId, skillId }),
    configure: (input) => ipcRenderer.invoke("skills:configure", input),
    compatibility: (projectId, skillId) => ipcRenderer.invoke("skills:compatibility", { projectId, skillId }),
    executions: (projectId) => ipcRenderer.invoke("skills:executions", projectId),
    cancel: (input) => ipcRenderer.invoke("skills:cancel", input),
    memory: (projectId) => ipcRenderer.invoke("skills:memory", projectId),
    remember: (input) => ipcRenderer.invoke("skills:remember", input),
    forget: (input) => ipcRenderer.invoke("skills:forget", input),
    exportMemory: (projectId) => ipcRenderer.invoke("skills:export-memory", projectId)
  },
  workflows: {
    advance: (input) => ipcRenderer.invoke("workflows:advance", input),
    execute: (input) => ipcRenderer.invoke("workflows:execute", input)
  },
  repositories: {
    clone: (input) => ipcRenderer.invoke("repositories:clone", input),
    status: (path) => ipcRenderer.invoke("repositories:status", path),
    createWorktree: (input) => ipcRenderer.invoke("repositories:create-worktree", input),
    checkpoint: (input) => ipcRenderer.invoke("repositories:checkpoint", input)
  },
  boards: {
    add: (input) => ipcRenderer.invoke("boards:add", input),
    move: (input) => ipcRenderer.invoke("boards:move", input)
  },
  threads: {
    post: (input) => ipcRenderer.invoke("threads:post", input),
    promote: (input) => ipcRenderer.invoke("threads:promote", input)
  },
  artifacts: {
    add: (input) => ipcRenderer.invoke("artifacts:add", input)
  },
  approvals: {
    list: (projectId) => ipcRenderer.invoke("approvals:list", projectId),
    request: (input) => ipcRenderer.invoke("approvals:request", input),
    decide: (input) => ipcRenderer.invoke("approvals:decide", input)
  },
  telemetry: {
    policy: () => ipcRenderer.invoke("telemetry:policy"),
    updatePolicy: (policy) => ipcRenderer.invoke("telemetry:update-policy", policy),
    summary: (projectId) => ipcRenderer.invoke("telemetry:summary", projectId),
    replay: (projectId, runId) => ipcRenderer.invoke("telemetry:replay", { projectId, runId }),
    pin: (projectId, runId, pinned) => ipcRenderer.invoke("telemetry:pin", { projectId, runId, pinned }),
    clear: (projectId) => ipcRenderer.invoke("telemetry:clear", projectId),
    export: (projectId) => ipcRenderer.invoke("telemetry:export", projectId)
  },
  privacy: {
    audit: () => ipcRenderer.invoke("privacy:audit"),
    isolation: (sessionId, workspace, provider) => ipcRenderer.invoke("privacy:isolation", { sessionId, workspace, provider })
  },
  github: {
    cliStatus: () => ipcRenderer.invoke("github:cli-status"),
    authenticateWithCli: () => ipcRenderer.invoke("github:authenticate-cli"),
    subscribeAuthCode(listener) {
      const handler = (_event: Electron.IpcRendererEvent, payload: { code: string }) => listener(payload);
      ipcRenderer.on("github:device-code", handler);
      return () => ipcRenderer.removeListener("github:device-code", handler);
    },
    beginDeviceFlow: (clientId) => ipcRenderer.invoke("github:begin-device-flow", { clientId }),
    pollDeviceFlow: (input) => ipcRenderer.invoke("github:poll-device-flow", input),
    repositories: () => ipcRenderer.invoke("github:repositories"),
    connection: () => ipcRenderer.invoke("github:connection"),
    branches: (repository) => ipcRenderer.invoke("github:branches", { repository }),
    tree: (repository, ref) => ipcRenderer.invoke("github:tree", { repository, ref }),
    file: (repository, sha, path) => ipcRenderer.invoke("github:file", { repository, sha, path }),
    commits: (repository, ref, page) => ipcRenderer.invoke("github:commits", { repository, ref, page }),
    issues: (repository, page) => ipcRenderer.invoke("github:issues", { repository, page }),
    createIssue: (input) => ipcRenderer.invoke("github:create-issue", input),
    updateIssue: (input) => ipcRenderer.invoke("github:update-issue", input),
    pullRequests: (repository, page) => ipcRenderer.invoke("github:pull-requests", { repository, page }),
    createPullRequest: (input) => ipcRenderer.invoke("github:create-pull-request", input),
    updatePullRequest: (input) => ipcRenderer.invoke("github:update-pull-request", input),
    push: (input) => ipcRenderer.invoke("github:push", input),
    deleteBranch: (input) => ipcRenderer.invoke("github:delete-branch", input),
    checks: (repository, ref) => ipcRenderer.invoke("github:checks", { repository, ref }),
    reviews: (repository, pullNumber) => ipcRenderer.invoke("github:reviews", { repository, pullNumber }),
    review: (input) => ipcRenderer.invoke("github:review", input),
    merge: (input) => ipcRenderer.invoke("github:merge", input),
    disconnect: () => ipcRenderer.invoke("github:disconnect")
  },
  networkPolicy: {
    requests: () => ipcRenderer.invoke("network:requests"),
    approvals: () => ipcRenderer.invoke("network:approvals"),
    decide: (input) => ipcRenderer.invoke("network:decide", input),
    revoke: (approvalId) => ipcRenderer.invoke("network:revoke", approvalId)
  },
  deployments: {
    targets: (projectId) => ipcRenderer.invoke("deployments:targets", projectId),
    preflight: (input) => ipcRenderer.invoke("deployments:preflight", input),
    start: (input) => ipcRenderer.invoke("deployments:start", input),
    status: (deploymentId) => ipcRenderer.invoke("deployments:status", deploymentId),
    rollback: (input) => ipcRenderer.invoke("deployments:rollback", input)
  },
  diagnostics: { export: (projectId) => ipcRenderer.invoke("diagnostics:export", projectId) },
  health: { inspect: (projectId) => ipcRenderer.invoke("health:inspect", projectId) },
  system: {
    openExternal: (url) => ipcRenderer.invoke("system:open-external", url),
    selectFolder: () => ipcRenderer.invoke("system:select-folder")
  },
  events: {
    subscribe(listener) {
      const handler = (_event: Electron.IpcRendererEvent, payload: AgentEvent) => listener(payload);
      ipcRenderer.on("agent:event", handler);
      return () => ipcRenderer.removeListener("agent:event", handler);
    }
  }
};

contextBridge.exposeInMainWorld("asteria", api);
