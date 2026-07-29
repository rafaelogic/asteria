import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, CpuIcon, FolderOpenIcon,
  GithubLogoIcon, LockKeyIcon, AtomIcon, ShieldCheckIcon, SparkleIcon, CopyIcon, XIcon, RobotIcon
} from "@phosphor-icons/react";
import { Brand } from "../components/Brand";
import { ProviderMark } from "../components/ProviderMark";
import type { OnboardingDraft, Project, ProviderId, ProviderStatus, SpecialistRole } from "../types";
import { DEFAULT_RADIO_SETTINGS } from "../radio";

const labels = ["Providers", "Git", "Repository", "Idea", "Roles", "RaDio", "Privacy", "Review"];
const initialDraft: OnboardingDraft = {
  step: 0,
  providers: ["codex"],
  defaultProvider: "codex",
  githubConnected: false,
  repository: "",
  repositoryPath: "",
  repositoryStoragePath: "",
  projectName: "",
  idea: "",
  audience: "",
  constraints: "",
  roles: ["frontend", "backend", "devops", "integrator"],
  radio: DEFAULT_RADIO_SETTINGS,
  telemetry: { enabled: true, replayEnabled: true, retentionDays: 30, quotaBytes: 5 * 1024 ** 3 }
};

const teamGroups: Array<{ number: string; title: string; detail: string; roles: SpecialistRole[]; required?: boolean }> = [
  { number: "01", title: "Planner", detail: "Requirements owner · always on", roles: ["planner"], required: true },
  { number: "02", title: "Design + Architect", detail: "Experience and contracts · always on", roles: ["product_designer", "architect"], required: true },
  { number: "03", title: "Frontend Developer", detail: "Interface implementation worktree", roles: ["frontend"] },
  { number: "04", title: "Backend Developer", detail: "Services and data worktree", roles: ["backend"] },
  { number: "05", title: "DevOps Engineer", detail: "Infrastructure implementation worktree", roles: ["devops"] },
  { number: "06", title: "Review + QA", detail: "Evidence gates · always on", roles: ["reviewer", "qa"], required: true },
  { number: "07", title: "Security + Release", detail: "Human-controlled ship · always on", roles: ["security"], required: true }
];

export function OnboardingScreen({ onComplete, onExplore, onCancel, existingProjectCount = 0 }: {
  onComplete: (project: Project) => void;
  onExplore: () => void;
  onCancel?: () => void;
  existingProjectCount?: number;
}) {
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("asteria.onboarding") ?? "") as OnboardingDraft;
      return { ...initialDraft, ...stored, radio: stored.radio ?? DEFAULT_RADIO_SETTINGS };
    } catch { return initialDraft; }
  });
  const [providers, setProviders] = useState<ProviderStatus[]>([
    { id: "codex", name: "OpenAI Codex", available: true, authenticated: true, version: "Detected" },
    { id: "claude", name: "Claude Code", available: true, authenticated: false, version: "Detected" }
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [githubLogin, setGithubLogin] = useState("");
  const [githubAuth, setGitHubAuth] = useState<{ code: string; pending: boolean } | null>(null);
  const [repositories, setRepositories] = useState<Array<{ id: number; fullName: string; private: boolean; cloneUrl: string }>>([]);
  const releaseGitHubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;
  const [githubCli, setGitHubCli] = useState<{ available: boolean; version?: string; message: string }>({ available: false, message: "Detecting GitHub CLI…" });

  useEffect(() => {
    localStorage.setItem("asteria.onboarding", JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    if (!onCancel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (githubAuth) setGitHubAuth(null);
      else onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [githubAuth, onCancel]);

  useEffect(() => {
    void window.asteria?.providers.detect().then(setProviders).catch(() => undefined);
    void window.asteria?.github.cliStatus().then(setGitHubCli).catch(() => setGitHubCli({ available: false, message: "GitHub CLI detection failed." }));
    void window.asteria?.github.connection().then(async (connection) => {
      if (!connection.connected) return;
      patch({ githubConnected: true });
      setGithubLogin(connection.login ?? "GitHub account");
      setRepositories(await window.asteria!.github.repositories());
    }).catch(() => undefined);
    return window.asteria?.github.subscribeAuthCode(({ code }) => setGitHubAuth({ code, pending: true }));
  }, []);

  const canContinue = useMemo(() => {
    if (draft.step === 0) return draft.providers.length > 0;
    if (draft.step === 2) return Boolean(draft.repositoryPath || (draft.repository && draft.repositoryStoragePath));
    if (draft.step === 3) return draft.projectName.trim().length > 1 && draft.idea.trim().length >= 10;
    return true;
  }, [draft]);

  const patch = (value: Partial<OnboardingDraft>) => setDraft((current) => ({ ...current, ...value }));
  const next = () => patch({ step: Math.min(labels.length - 1, draft.step + 1) });
  const back = () => patch({ step: Math.max(0, draft.step - 1) });
  const toggleProvider = (provider: ProviderId) => {
    const nextProviders = draft.providers.includes(provider) ? draft.providers.filter((id) => id !== provider) : [...draft.providers, provider];
    patch({ providers: nextProviders, defaultProvider: nextProviders.includes(draft.defaultProvider) ? draft.defaultProvider : nextProviders[0] ?? "codex" });
  };
  const toggleRoles = (roles: SpecialistRole[]) => {
    const selected = new Set(draft.roles ?? []);
    const remove = roles.every((role) => selected.has(role));
    roles.forEach((role) => remove ? selected.delete(role) : selected.add(role));
    patch({ roles: [...selected] });
  };
  const chooseFolder = async () => {
    const folder = await window.asteria?.system.selectFolder();
    if (!folder) return;
    try {
      await window.asteria?.repositories.status(folder);
      setError("");
      patch({ repositoryPath: folder, repository: "", repositoryStoragePath: "", projectName: draft.projectName || folder.split(/[\\/]/).pop() || "" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Choose the root folder of a Git repository.");
    }
  };
  const chooseStorage = async () => {
    const folder = await window.asteria?.system.selectFolder();
    if (folder) {
      setError("");
      patch({ repositoryStoragePath: folder });
    }
  };
  const authenticate = async (provider: ProviderId) => {
    setError("");
    try {
      if (!window.asteria) {
        setProviders((current) => current.map((item) => item.id === provider ? { ...item, authenticated: true } : item));
        return;
      }
      await window.asteria.providers.authenticate(provider);
      setProviders((current) => current.map((item) => item.id === provider ? { ...item, authenticated: true } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Provider authentication failed."); }
  };
  const connectGitHub = async (connectDifferentAccount = false) => {
    setError("");
    setGitHubAuth(null);
    if (!window.asteria) { patch({ githubConnected: true }); setGithubLogin("demo-user"); return; }
    try {
      const existing = await window.asteria.github.connection();
      if (existing.connected && !connectDifferentAccount) {
        patch({ githubConnected: true });
        setGithubLogin(existing.login ?? "GitHub account");
        setRepositories(await window.asteria.github.repositories());
        return;
      }
      if (githubCli.available) {
        const result = await window.asteria.github.authenticateWithCli();
        patch({ githubConnected: true });
        setGithubLogin(result.login);
        setRepositories(await window.asteria.github.repositories());
        setGitHubAuth(null);
        return;
      }
      const clientId = releaseGitHubClientId;
      if (!clientId) throw new Error("GitHub CLI is not installed. Install gh or continue with local Git.");
      const flow = await window.asteria.github.beginDeviceFlow(clientId);
      setGitHubAuth({ code: flow.userCode, pending: true });
      await window.asteria.system.openExternal(flow.verificationUri);
      let result: { connected: boolean; login?: string } = { connected: false };
      for (let attempt = 0; attempt < 60 && !result.connected; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, flow.interval * 1000));
        result = await window.asteria.github.pollDeviceFlow({ clientId, deviceCode: flow.deviceCode, interval: flow.interval });
      }
      if (!result.connected) throw new Error("GitHub authorization timed out.");
      patch({ githubConnected: true });
      setGithubLogin(result.login ?? "GitHub");
      setRepositories(await window.asteria.github.repositories());
      setGitHubAuth(null);
    } catch (reason) {
      setGitHubAuth((current) => current ? { ...current, pending: false } : null);
      setError(reason instanceof Error ? reason.message : "GitHub connection failed.");
    }
  };
  const finish = async () => {
    setBusy(true); setError("");
    try {
      if (window.asteria) {
        let completedDraft = draft;
        const remote = repositories.find((repository) => repository.fullName === draft.repository);
        if (draft.repository && !draft.repositoryPath) {
          if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(draft.repository)) {
            throw new Error("Enter a GitHub repository as owner/name, or choose a local Git repository.");
          }
          const cloneUrl = remote?.cloneUrl ?? `https://github.com/${draft.repository}.git`;
          if (!draft.repositoryStoragePath) throw new Error("Choose where RaDio should store this project.");
          const cloned = await window.asteria.repositories.clone({ cloneUrl, projectName: draft.projectName, storagePath: draft.repositoryStoragePath, idempotencyKey: `clone_${crypto.randomUUID()}` });
          completedDraft = { ...draft, repositoryPath: cloned.path };
        }
        if (!completedDraft.repositoryPath) throw new Error("Choose or clone a local Git repository before creating the project.");
        const created = await window.asteria.projects.create({ ...completedDraft, idempotencyKey: `onboard_${crypto.randomUUID()}` });
        onComplete(created);
      } else {
        localStorage.setItem("asteria.onboarded", "true");
        onExplore();
      }
      localStorage.removeItem("asteria.onboarding");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Project creation failed.");
    } finally { setBusy(false); }
  };

  return (
    <div className="onboarding-shell">
      <header className="onboarding-top">
        <Brand />
        <span className="onboarding-top-actions">
          <span><LockKeyIcon /> Local-first orchestration</span>
          {onCancel && <button className="button ghost onboarding-exit" onClick={onCancel} aria-label="Cancel new project and return to projects"><XIcon /> Back to projects</button>}
        </span>
      </header>
      <aside className="onboarding-progress">
        <div><span className="eyebrow">{existingProjectCount ? "New project" : "First run"}</span><h1>Prepare your starpath</h1><p>{existingProjectCount ? "Your existing projects remain unchanged while this starpath is configured." : "Connect the tools once. Every project and run remains isolated afterward."}</p></div>
        <ol><i className="stepper-signal" style={{ "--step-index": draft.step } as React.CSSProperties} />{labels.map((label, index) => <li className={index === draft.step ? "active" : index < draft.step ? "complete" : ""} key={label}><span>{index < draft.step ? <CheckCircleIcon weight="fill" /> : index + 1}</span>{label}</li>)}</ol>
        <div className="onboarding-privacy"><ShieldCheckIcon /><span><strong>No remote analytics</strong><small>Replay and performance data stay encrypted on this device.</small></span></div>
      </aside>
      <main className="onboarding-main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section key={draft.step} className="wizard-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .22 }}>
            {draft.step === 0 && <WizardSection icon={<CpuIcon />} eyebrow="Agent providers" title="Choose your intelligence layer" description="Asteria detects installed CLIs and authenticates them inside app-owned profiles.">
              <div className="provider-grid">{providers.map((provider) => <button key={provider.id} className={`provider-choice ${draft.providers.includes(provider.id) ? "selected" : ""}`} onClick={() => toggleProvider(provider.id)} disabled={!provider.available}>
                <span className={`provider-orb ${provider.id}`}><ProviderMark provider={provider.id} size={20} /></span><span><strong>{provider.name}</strong><small>{provider.available ? provider.version ?? "Available" : "CLI not installed"}</small></span><b>{draft.providers.includes(provider.id) ? "Selected" : "Select"}</b>
              </button>)}</div>
              <div className="provider-auth-actions">{providers.filter((provider) => provider.available).map((provider) => <button className="text-button" key={provider.id} onClick={() => void authenticate(provider.id)}>{provider.authenticated ? <CheckCircleIcon weight="fill" /> : <LockKeyIcon />} {provider.authenticated ? `${provider.name} authenticated` : `Sign in to ${provider.name}`}</button>)}</div>
              <label className="select-field"><span>Default provider</span><select value={draft.defaultProvider} onChange={(event) => patch({ defaultProvider: event.target.value as ProviderId })}>{draft.providers.map((provider) => <option value={provider} key={provider}>{provider === "codex" ? "OpenAI Codex" : "Claude Code"}</option>)}</select></label>
            </WizardSection>}
            {draft.step === 1 && <WizardSection icon={<GithubLogoIcon />} eyebrow="Source control" title="Connect GitHub or stay local" description="GitHub CLI opens github.com for authorization and shows every requested scope before you approve.">
              <div className="cli-detection"><CheckCircleIcon weight={githubCli.available ? "fill" : "regular"} /><span><strong>{githubCli.available ? "GitHub CLI ready" : "GitHub CLI unavailable"}</strong><small>{githubCli.version ?? githubCli.message}</small></span></div>
              <button className={`connect-card ${draft.githubConnected ? "connected" : ""}`} onClick={() => void connectGitHub()}><GithubLogoIcon /><span><strong>{draft.githubConnected ? `Reuse ${githubLogin || "connected GitHub account"}` : "Connect GitHub"}</strong><small>{draft.githubConnected ? "Application-level authorization · available to this new project" : "Issues, pull requests, checks, and reviews"}</small></span><b>{draft.githubConnected ? "Use account" : "Connect"}</b></button>
              {draft.githubConnected && <button className="text-button github-account-switch" onClick={() => void connectGitHub(true)}>Connect a different GitHub account</button>}
              <p className="micro-note">Authorization opens on github.com. Asteria imports the token into its credential vault, then removes the temporary isolated GitHub CLI profile. Your normal GitHub CLI profile is untouched.</p>
              {error && <p className="wizard-error">{error}</p>}
              <div className="divider"><span>or</span></div><button className="button secondary wide" onClick={next}>Continue with local Git</button>
            </WizardSection>}
            {draft.step === 2 && <WizardSection icon={<FolderOpenIcon />} eyebrow="Repository" title="Select the project workspace" description="Asteria creates isolated task worktrees without changing your original working copy.">
              <button className="repository-card" onClick={() => void chooseFolder()}><FolderOpenIcon /><span><strong>{draft.repositoryPath || "Choose a local Git repository"}</strong><small>Original files remain outside agent session homes</small></span><ArrowRightIcon /></button>
              {draft.githubConnected && <label className="form-field"><span>GitHub repository</span>{repositories.length ? <select value={draft.repository} onChange={(event) => patch({ repository: event.target.value, repositoryPath: "", projectName: draft.projectName || event.target.value.split("/").pop() || "" })}><option value="">Choose a repository…</option>{repositories.map((repository) => <option value={repository.fullName} key={repository.id}>{repository.fullName}{repository.private ? " · Private" : ""}</option>)}</select> : <input value={draft.repository} onChange={(event) => patch({ repository: event.target.value, repositoryPath: "", projectName: draft.projectName || event.target.value.split("/").pop() || "" })} placeholder="organization/repository" />}</label>}
              {draft.repository && !draft.repositoryPath && <button className="repository-card storage-card" onClick={() => void chooseStorage()}><FolderOpenIcon /><span><strong>{draft.repositoryStoragePath || "Choose where RaDio should store the project"}</strong><small>RaDio will clone {draft.repository} into this folder</small></span><ArrowRightIcon /></button>}
              {error && <p className="wizard-error">{error}</p>}
            </WizardSection>}
            {draft.step === 3 && <WizardSection icon={<SparkleIcon />} eyebrow="Product intent" title="What should this project become?" description="Give the Planner enough context to create measurable requirements before any code is changed.">
              <div className="form-grid"><label className="form-field"><span>Project name</span><input value={draft.projectName} onChange={(event) => patch({ projectName: event.target.value })} placeholder="A clear project name" /></label><label className="form-field full"><span>Idea and outcome</span><textarea value={draft.idea} onChange={(event) => patch({ idea: event.target.value })} placeholder="Build a product that helps…" /></label><label className="form-field"><span>Target users</span><input value={draft.audience} onChange={(event) => patch({ audience: event.target.value })} placeholder="Who is this for?" /></label><label className="form-field"><span>Constraints</span><input value={draft.constraints} onChange={(event) => patch({ constraints: event.target.value })} placeholder="Platform, deadline, compliance…" /></label></div>
            </WizardSection>}
            {draft.step === 4 && <WizardSection icon={<AtomIcon />} eyebrow="Adaptive team" title="A focused team, activated by need" description="Core roles stay present. Specialists join only when their contracts are required.">
              <div className="role-map">{teamGroups.map((group) => {
                const selected = group.required || group.roles.some((role) => draft.roles?.includes(role));
                return <button type="button" key={group.number} className={`role ${group.required ? "core" : ""} ${selected ? "active" : ""}`} disabled={group.required} aria-pressed={selected} onClick={() => toggleRoles(group.roles)}>
                  <span>{selected ? <CheckCircleIcon weight="fill" /> : group.number}</span><strong>{group.title}</strong><small>{group.detail}</small><b>{group.required ? "Required" : selected ? "Selected" : "Add"}</b>
                </button>;
              })}</div>
              <p className="micro-note">This configures the new project. After launch, change each role’s provider in Project settings without affecting another project.</p>
            </WizardSection>}
            {draft.step === 5 && <WizardSection icon={<RobotIcon />} eyebrow="RaDio authority" title="Choose how RaDio operates" description="Both modes keep Orbit isolation, safety policy, budgets, Waypoints, and an emergency stop.">
              <div className="radio-mode-grid">
                {([
                  { id: "autonomous", title: "Guided", detail: "RaDio researches, builds, tests, repairs, commits, and creates Observations. External changes still require approval." },
                  { id: "full_autonomous", title: "Ascendant", detail: "RaDio can push scoped branches, manage PRs, and deploy to configured staging without routine prompts." }
                ] as const).map((mode) => <button key={mode.id} type="button" className={`radio-mode-card ${draft.radio.mode === mode.id ? "active" : ""}`} onClick={() => patch({ radio: { ...draft.radio, mode: mode.id } })}>
                  <span><RobotIcon weight="duotone" /><strong>{mode.title}</strong></span><p>{mode.detail}</p><b>{draft.radio.mode === mode.id ? "Selected" : "Choose"}</b>
                </button>)}
              </div>
              <label className="form-field"><span>Staging branch</span><input value={draft.radio.stagingBranch} onChange={(event) => patch({ radio: { ...draft.radio, stagingBranch: event.target.value } })} /></label>
              <div className="radio-safety-note"><SparkleIcon weight="duotone" /><span><strong>Recommended competency set</strong><small>Repository Manager, Stack Detector, Planner, Implementation, Test and Repair, Security Reviewer, Release Manager, and Recovery activate automatically when compatible.</small></span></div>
              <ToggleRow title="Automatic RaDio skills" detail="Use trusted built-ins and approved Orbit recipes at the relevant Coordinate" checked={draft.radio.skillsEnabled} onChange={(skillsEnabled) => patch({ radio: { ...draft.radio, skillsEnabled } })} />
              <ToggleRow title="Encrypted Orbit memory" detail="Off by default; retain redacted conventions and outcomes only for this Orbit" checked={draft.radio.memoryEnabled} onChange={(memoryEnabled) => patch({ radio: { ...draft.radio, memoryEnabled, ownerMemoryEnabled: memoryEnabled ? draft.radio.ownerMemoryEnabled : false } })} />
              {draft.radio.mode === "full_autonomous" && <ToggleRow title="Merge and deploy production" detail="Disabled by default. Verified PRs only; direct main/master pushes remain prohibited." checked={draft.radio.mergeProductionEnabled} onChange={(mergeProductionEnabled) => patch({ radio: { ...draft.radio, mergeProductionEnabled } })} />}
              <div className="radio-safety-note"><ShieldCheckIcon /><span><strong>Non-bypassable safety</strong><small>RaDio never deletes or destructively migrates live production data without focused human approval.</small></span></div>
            </WizardSection>}
            {draft.step === 6 && <WizardSection icon={<ShieldCheckIcon />} eyebrow="Local telemetry" title="Full replay, without remote tracking" description="Operational events are redacted before encrypted persistence and never receive a network destination.">
              <div className="telemetry-options"><ToggleRow title="Local telemetry" detail="Cycle time, reliability, cost estimates, approvals, and failures" checked={draft.telemetry.enabled} onChange={(enabled) => patch({ telemetry: { ...draft.telemetry, enabled } })} /><ToggleRow title="Full redacted replay" detail="Provider transcripts, tools, decisions, state transitions, and artifacts" checked={draft.telemetry.replayEnabled} onChange={(replayEnabled) => patch({ telemetry: { ...draft.telemetry, replayEnabled } })} /></div>
              <div className="retention-facts"><span><small>Retention</small><strong>30 days</strong></span><span><small>Storage quota</small><strong>5 GB</strong></span><span><small>Uploads</small><strong className="success">None</strong></span></div>
            </WizardSection>}
            {draft.step === 7 && <WizardSection icon={<CheckCircleIcon />} eyebrow="Ready to launch" title={`Create ${draft.projectName || "your project"} starpath`} description="Asteria will begin with product definition under the selected RaDio authority.">
              <div className="review-list"><ReviewRow label="Provider" value={draft.defaultProvider === "codex" ? "OpenAI Codex" : "Claude Code"} /><ReviewRow label="Repository" value={draft.repository || draft.repositoryPath || "Local repository"} /><ReviewRow label="Stored in" value={draft.repositoryStoragePath || draft.repositoryPath} /><ReviewRow label="Objective" value={draft.idea || "Product definition required"} /><ReviewRow label="RaDio" value={draft.radio.mode === "full_autonomous" ? `Ascendant · ${draft.radio.mergeProductionEnabled ? "production enabled" : "staging only"}` : "Guided · external gates"} /><ReviewRow label="Skills" value={draft.radio.skillsEnabled ? "Automatic trusted catalog" : "Disabled"} /><ReviewRow label="Memory" value={draft.radio.memoryEnabled ? "Encrypted · Orbit only" : "Off"} /><ReviewRow label="Starpath" value="Scout → Observation · adaptive Stars" /><ReviewRow label="Telemetry" value={draft.telemetry.enabled ? "Local encrypted · 30 days" : "Paused"} /></div>
              {error && <p className="wizard-error">{error}</p>}
            </WizardSection>}
          </motion.section>
        </AnimatePresence>
        <footer className="wizard-footer">{draft.step === 0 ? (onCancel || !window.asteria ? <button className="button ghost" onClick={onCancel ?? onExplore}><ArrowLeftIcon /> {onCancel ? "Back to projects" : "Explore demo"}</button> : <span />) : <button className="button ghost" onClick={back}><ArrowLeftIcon /> Back</button>}<span>Step {draft.step + 1} of {labels.length}</span>{draft.step < labels.length - 1 ? <button className="button primary" disabled={!canContinue} onClick={next}>Continue <ArrowRightIcon /></button> : <button className="button primary launch" disabled={busy} onClick={() => void finish()}>{busy ? <><span className="mini-orbit" /> Creating starpath…</> : <>Launch project <AtomIcon /></>}</button>}</footer>
      </main>
      {githubAuth && <div className="modal-backdrop github-code-backdrop" role="presentation">
        <section className="github-code-modal" role="dialog" aria-modal="true" aria-labelledby="github-code-title">
          <header><span className="wizard-icon"><GithubLogoIcon /></span><div><span className="eyebrow">GitHub authorization</span><h2 id="github-code-title">Enter this code on GitHub</h2></div><button className="icon-button" aria-label="Dismiss authorization details" onClick={() => setGitHubAuth(null)}><XIcon /></button></header>
          <p>Asteria copied the code to your clipboard. It remains visible here in case your clipboard changes.</p>
          <button className="device-code" onClick={() => void navigator.clipboard.writeText(githubAuth.code)}><code>{githubAuth.code}</code><span><CopyIcon /> Copy code</span></button>
          <small>{githubAuth.pending ? "Waiting for authorization in your browser…" : "Authorization did not complete. Close this window and try connecting again."}</small>
        </section>
      </div>}
    </div>
  );
}

function WizardSection({ icon, eyebrow, title, description, children }: { icon: React.ReactNode; eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <><div className="wizard-heading"><span className="wizard-icon">{icon}</span><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div></div><div className="wizard-content">{children}</div></>;
}
function ToggleRow({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <button className="toggle-row" onClick={() => onChange(!checked)}><span><strong>{title}</strong><small>{detail}</small></span><i className={checked ? "toggle on" : "toggle"}><b /></i></button>;
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong><CheckCircleIcon weight="fill" /></div>;
}
