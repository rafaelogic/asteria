import { useEffect, useState } from "react";
import { BellIcon, CheckCircleIcon, CpuIcon, GitBranchIcon, PlusIcon, RobotIcon, ShieldCheckIcon, SirenIcon, SwapIcon } from "@phosphor-icons/react";
import type { Project, ProviderAccountProfile, ProviderId, ProviderStatus, RaDioMode, SpecialistRole } from "../types";
import { ProviderMark } from "../components/ProviderMark";

const roles: Array<{ id: SpecialistRole; label: string }> = [
  { id: "planner", label: "Product Planner" }, { id: "architect", label: "Technical Architect" },
  { id: "frontend", label: "Frontend Developer" }, { id: "backend", label: "Backend Developer" },
  { id: "reviewer", label: "Reviewer" }, { id: "qa", label: "QA Engineer" },
  { id: "security", label: "Security Reviewer" }, { id: "devops", label: "DevOps Engineer" }
];

const demoAccounts: ProviderAccountProfile[] = [
  { id: "demo-codex", nickname: "Codex primary", provider: "codex", enabled: true, order: 0, authenticated: true, capabilities: ["structured-stream", "cancellation", "isolated-home", "tool-events"], health: "healthy", usage: { remainingPercent: 62, source: "provider", capturedAt: new Date().toISOString() }, activeSessions: 1, concurrencyLimit: 2, failureRate: .01, allowedProjectIds: [], allowedRoles: [] },
  { id: "demo-claude", nickname: "Claude reserve", provider: "claude", enabled: true, order: 1, authenticated: true, capabilities: ["structured-stream", "cancellation", "isolated-home", "tool-events"], health: "healthy", usage: { remainingPercent: 88, source: "provider", capturedAt: new Date().toISOString() }, activeSessions: 0, concurrencyLimit: 1, failureRate: .02, allowedProjectIds: [], allowedRoles: [] }
];

export function SettingsScreen({ project, onProject }: { project: Project; onProject: (project: Project) => void }) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [accounts, setAccounts] = useState<ProviderAccountProfile[]>(window.asteria ? [] : demoAccounts);
  useEffect(() => {
    void window.asteria?.providers.detect().then(setProviders).catch(() => undefined);
    void window.asteria?.accounts.list().then(setAccounts).catch(() => undefined);
  }, []);
  const base = { projectId: project.id, runId: project.runId, expectedVersion: project.version };
  const assign = async (role: SpecialistRole, provider: ProviderId) => {
    const roleProviders = { ...project.roleProviders, [role]: provider };
    if (window.asteria) onProject(await window.asteria.projects.update({ ...base, idempotencyKey: `role_${crypto.randomUUID()}`, patch: { roleProviders } }));
    else onProject({ ...project, version: project.version + 1, roleProviders });
  };
  const saveRaDio = async (patch: Partial<Project["radio"]>) => {
    const settings = { ...project.radio, ...patch };
    if (window.asteria) onProject(await window.asteria.radio.updateSettings({ ...base, idempotencyKey: `radio_settings_${crypto.randomUUID()}`, settings }));
    else onProject({ ...project, version: project.version + 1, radio: settings });
  };
  const toggleAccount = async (profileId: string) => {
    const selected = project.radio.accountPool.accountIds.includes(profileId);
    const accountIds = selected ? project.radio.accountPool.accountIds.filter((id) => id !== profileId) : [...project.radio.accountPool.accountIds, profileId];
    await saveRaDio({ accountPool: { ...project.radio.accountPool, enabled: accountIds.length > 0, accountIds } });
  };
  const addAccount = async (provider: ProviderId) => {
    if (!window.asteria) return;
    const profile = await window.asteria.accounts.add({ provider, nickname: `${provider === "codex" ? "Codex" : "Claude"} account ${accounts.filter((item) => item.provider === provider).length + 1}` });
    setAccounts((current) => [...current, profile]);
    await window.asteria.accounts.authenticate(profile.id);
    setAccounts(await window.asteria.accounts.list());
  };
  const emergencyStop = async () => {
    if (window.asteria) onProject(await window.asteria.radio.emergencyStop({ ...base, idempotencyKey: `radio_stop_${crypto.randomUUID()}` }));
    else onProject({ ...project, version: project.version + 1, runStatus: "paused", radio: { ...project.radio, enabled: false, emergencyStopped: true } });
  };
  return <div className="screen standard-screen settings-screen"><header className="section-header"><div><span className="eyebrow">{project.name} · Configuration</span><h1>Project settings</h1><p>RaDio authority, account failover, provider routing, budgets, and isolation belong to this project.</p></div><span className="local-badge"><ShieldCheckIcon /> Isolated</span></header>
    <section className="settings-panel radio-control-panel"><header><RobotIcon weight="duotone" /><div><h2>RaDio autonomous core</h2><p>Deterministic permissions wrap every agent and tool action.</p></div><b className={project.radio.emergencyStopped ? "danger" : "success"}>{project.radio.emergencyStopped ? "Stopped" : "Active"}</b></header>
      <div className="radio-settings-grid"><label><span>Operating mode</span><select value={project.radio.mode} onChange={(event) => void saveRaDio({ mode: event.target.value as RaDioMode })}><option value="autonomous">Guided</option><option value="full_autonomous">Ascendant</option></select></label><label><span>Staging branch</span><input key={project.radio.stagingBranch} defaultValue={project.radio.stagingBranch} onBlur={(event) => { if (event.target.value !== project.radio.stagingBranch) void saveRaDio({ stagingBranch: event.target.value }); }} /></label><button className="toggle-row compact" onClick={() => void saveRaDio({ mergeProductionEnabled: !project.radio.mergeProductionEnabled })}><span><strong>Merge + production</strong><small>Verified PRs only · no direct pushes</small></span><i className={project.radio.mergeProductionEnabled ? "toggle on" : "toggle"}><b /></i></button><button className="danger-button" onClick={() => void emergencyStop()}><SirenIcon /> Emergency stop</button></div>
    </section>
    <section className="settings-panel account-pool-panel"><header><SwapIcon /><div><h2>Provider account pool</h2><p>Cross-provider handoff at 5% authoritative remaining usage. Unknown usage is never estimated.</p></div><span className="account-pool-actions"><button className="text-button" onClick={() => void addAccount("codex")}><PlusIcon /> Codex</button><button className="text-button" onClick={() => void addAccount("claude")}><PlusIcon /> Claude</button></span></header>
      <div className="account-pool-list">{accounts.map((account) => { const selected = project.radio.accountPool.accountIds.includes(account.id); const remaining = account.usage.remainingPercent; return <button key={account.id} className={`account-profile ${selected ? "selected" : ""}`} onClick={() => void toggleAccount(account.id)}><span className={`provider-health-mark ${account.provider}`}><ProviderMark provider={account.provider} size={20} /></span><span><strong>{account.nickname}</strong><small>{account.provider === "codex" ? "OpenAI Codex" : "Claude Code"} · {account.health}</small></span><span className="usage-meter"><i><b style={{ width: `${remaining ?? 0}%` }} /></i><small>{remaining === undefined ? "Usage unavailable" : `${remaining}% remaining`}</small></span><b>{selected ? "In pool" : "Add"}</b></button>; })}</div>
    </section>
    <div className="settings-layout"><section className="settings-panel"><header><CpuIcon /><div><h2>Role routing</h2><p>Use the project default or assign a provider per specialist.</p></div></header><div className="role-settings">{roles.map((role) => <label key={role.id}><span><strong>{role.label}</strong><small>{role.id}</small></span><select value={project.roleProviders?.[role.id] ?? project.provider} onChange={(event) => void assign(role.id, event.target.value as ProviderId)}><option value="codex">OpenAI Codex</option><option value="claude">Claude Code</option></select></label>)}</div></section>
      <div className="settings-stack"><section className="settings-panel"><header><CheckCircleIcon /><div><h2>Provider health</h2><p>Installed CLI capability detection.</p></div></header><div className="health-list">{providers.length ? providers.map((provider) => <div key={provider.id}><span className={`provider-health-mark ${provider.id}`}><ProviderMark provider={provider.id} size={20} /></span><span><strong>{provider.name}</strong><small>{provider.version ?? "Version unavailable"}</small></span><b className={provider.available ? "success" : ""}>{provider.available ? "Ready" : "Missing"}</b></div>) : <p className="muted-copy">Health checks are available in the Electron application.</p>}</div></section>
        <section className="settings-panel"><header><BellIcon /><div><h2>Notifications</h2><p>Safety stops, failures, budgets, and releases.</p></div></header><button className="button secondary wide" onClick={() => void Notification.requestPermission()}>Enable desktop notifications</button></section>
        <section className="settings-panel"><header><GitBranchIcon /><div><h2>Run budget</h2><p>{project.budget.usedMinutes} of {project.budget.minutes} minutes · {Math.round(project.budget.usedTokens / 1000)}k of {Math.round(project.budget.tokenLimit / 1000)}k tokens</p></div></header><div className="budget-bar"><b style={{ width: `${Math.min(100, project.budget.usedMinutes / project.budget.minutes * 100)}%` }} /></div></section></div></div>
  </div>;
}
