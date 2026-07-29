import { memo, useEffect, useMemo, useState } from "react";
import { ArrowUpIcon, CheckCircleIcon, FolderOpenIcon, HardDrivesIcon, LightbulbIcon, MagicWandIcon, PulseIcon, RobotIcon, StopCircleIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { MarkdownPreview } from "../components/RichPreview";
import type { ApplicationMaintenanceSettings, Project, UserInstallState } from "../types";
import { useRadioReadiness } from "../hooks/useRadioReadiness";
import { ResponseActivity } from "../components/ResponseActivity";

const MaintenanceMarkdown = memo(MarkdownPreview);

export function improveMaintenancePrompt(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const sentence = `${clean.charAt(0).toUpperCase()}${clean.slice(1)}`.replace(/[.?!]*$/, ".");
  const request = /^(what|which|who|when|where|why|how|is|are|can|could|does|do)\b/i.test(sentence)
    ? `Please explain ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`
    : /^(check|diagnose|explain|fix|inspect|review|summarize|verify|update|show|run)\b/i.test(sentence)
      ? sentence
      : `Please ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
  const needsEvidence = /\b(check|diagnose|fix|inspect|review|verify|run|update)\b/i.test(request);
  return `${request}${needsEvidence ? " Inspect the relevant Asteria state first, preserve unrelated changes, and report the evidence from each verification." : " Use the current application state and keep the response focused on Asteria maintenance."}`;
}

export function MaintenanceRadioScreen({ projects, onOpenProject }: { projects: Project[]; onOpenProject: (projectId: string) => void }) {
  const [install, setInstall] = useState<UserInstallState>({ rollbackReady: false });
  const [state, setState] = useState<ApplicationMaintenanceSettings>();
  const [body, setBody] = useState("");
  const [selectedOrbit, setSelectedOrbit] = useState("");
  const [error, setError] = useState("");
  const [promptImproved, setPromptImproved] = useState(false);
  const readiness = useRadioReadiness(state?.provider ?? "codex");
  const localOrbits = projects.filter((project) => project.repositoryPath);
  useEffect(() => {
    void window.asteria?.installer.state().then(setInstall);
    void window.asteria?.maintenance.state().then(setState);
  }, []);
  useEffect(() => {
    if (!state?.chat.messages.some((message) => message.status === "streaming")) return;
    const timer = window.setInterval(() => void window.asteria?.maintenance.state().then(setState), 800);
    return () => window.clearInterval(timer);
  }, [state?.chat.messages]);
  const incidents = useMemo(() => projects.flatMap((project) => project.incidents.filter((incident) => incident.status !== "resolved").map((incident) => ({ project, incident }))), [projects]);
  const observations = useMemo(() => projects.reduce((total, project) => total + project.artifacts.length, 0), [projects]);
  const pending = state?.pendingOperation;
  const isStreaming = state?.chat.messages.some((message) => message.status === "streaming") ?? false;
  const starters = incidents.length
    ? ["Summarize unresolved incidents and recommend the safest next action.", "Check installation health and rollback readiness.", "Prepare a concise maintenance report with verification evidence."]
    : ["Give me an Asteria health summary.", "Check installation and rollback readiness.", "Explain what Maintenance RaDio can safely inspect."];

  const send = async () => {
    if (!window.asteria || !state || !body.trim() || !readiness.ready) return;
    setError("");
    try {
      const latest = await window.asteria.maintenance.state();
      const updated = await window.asteria.maintenance.send({ expectedVersion: latest.version, idempotencyKey: `maintenance_${crypto.randomUUID()}`, operationId: crypto.randomUUID(), body });
      setState(updated); setBody(""); setPromptImproved(false);
    } catch (value) { setError(value instanceof Error ? value.message : "Maintenance RaDio could not send this message."); }
  };
  const selectSource = async (source: "folder" | "orbit") => {
    if (!window.asteria || !state || !pending) return;
    setError("");
    try {
      setState(await window.asteria.maintenance.selectSource({ expectedVersion: state.version, idempotencyKey: `maintenance_source_${crypto.randomUUID()}`, operationId: pending.operationId, source, projectId: source === "orbit" ? selectedOrbit : undefined }));
    } catch (value) { setError(value instanceof Error ? value.message : "The Asteria source could not be validated."); }
  };
  const disconnect = async () => {
    if (window.asteria && state) setState(await window.asteria.maintenance.disconnectSource({ expectedVersion: state.version, idempotencyKey: `maintenance_disconnect_${crypto.randomUUID()}` }));
  };
  const cancel = async (messageId: string) => {
    if (window.asteria && state) setState(await window.asteria.maintenance.cancel({ expectedVersion: state.version, idempotencyKey: `maintenance_cancel_${crypto.randomUUID()}`, messageId }));
  };

  return <div className="screen maintenance-radio-screen">
    <header className="screen-header"><div><span className="eyebrow">Application maintenance</span><h1><RobotIcon weight="duotone" /> Maintenance RaDio</h1><p>Application-scoped health, installation, recovery, and reports—isolated from every Orbit conversation.</p></div>{state?.source && <button className="button secondary" onClick={() => void disconnect()}><XIcon /> Disconnect source</button>}</header>
    <section className="maintenance-summary">
      <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><PulseIcon /><span><small>Application health</small><strong>{incidents.length ? "Attention required" : "Healthy"}</strong><p>{incidents.length} unresolved incident{incidents.length === 1 ? "" : "s"} across {projects.length} Orbits</p></span></motion.article>
      <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .06 }}><HardDrivesIcon /><span><small>Installed release</small><strong>{install.currentVersion ?? "Development"}</strong><p>{install.rollbackReady ? `Rollback ready${install.previousVersion ? ` · ${install.previousVersion}` : ""}` : "No previous user release"}</p></span></motion.article>
      <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}><CheckCircleIcon /><span><small>Source access</small><strong>{state?.source ? "Validated" : "Just in time"}</strong><p>{state?.source ? `${state.source.repository} · ${state.source.source}` : "Requested only for code work"}</p></span></motion.article>
    </section>
    <div className="maintenance-layout">
      <section className="maintenance-chat">
        <header><span><strong>Application conversation</strong><small>{observations} encrypted Observations available</small></span><b>{state?.provider ?? "codex"}</b></header>
        <div className="maintenance-messages"><AnimatePresence initial={false}>{state?.chat.messages.length ? state.chat.messages.map((message) => <motion.article layout initial={{ opacity: 0, y: 10, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .24 }} key={message.id} className={message.author}>
          <span>{message.author === "radio" ? <RobotIcon weight="duotone" /> : "You"}</span>
          <div><header><strong>{message.author === "radio" ? "Maintenance RaDio" : "Rafael"}</strong><small>{message.status.replaceAll("_", " ")}</small></header>{message.body && <MaintenanceMarkdown content={message.body} />}
            {message.status === "streaming" && <ResponseActivity hasContent={Boolean(message.body)} />}
            {message.status === "waiting_for_source" && pending?.operationId === message.operationId && <div className="source-required-card">
              <FolderOpenIcon /><div><strong>Asteria source required</strong><p>Choose a repository only when RaDio begins code analysis. Its path stays out of provider prompts.</p>
                <button className="button primary" onClick={() => void selectSource("folder")}>Choose Asteria repository</button>
                {localOrbits.length > 0 && <div className="source-orbit-row"><select aria-label="Existing local Orbit" value={selectedOrbit} onChange={(event) => setSelectedOrbit(event.target.value)}><option value="">Choose local Orbit…</option>{localOrbits.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button className="button secondary" disabled={!selectedOrbit} onClick={() => void selectSource("orbit")}>Use Orbit</button></div>}
              </div>
            </div>}
            {message.status === "streaming" && <button className="text-button" onClick={() => void cancel(message.id)}><StopCircleIcon /> Stop response</button>}
          </div>
        </motion.article>) : <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="maintenance-chat-empty"><RobotIcon weight="duotone" /><h3>Ask Maintenance RaDio</h3><p>Status and reports need no repository. Source access is requested only when code work begins.</p><div>{starters.map((starter) => <button key={starter} onClick={() => { setBody(starter); setPromptImproved(false); }}>{starter}</button>)}</div></motion.div>}</AnimatePresence></div>
        {error && <p className="radio-send-error" role="alert">{error}</p>}
        {!readiness.ready && <div className="radio-readiness"><strong>{readiness.loading ? "Checking RaDio prerequisites…" : "Maintenance RaDio is not ready yet"}</strong>{readiness.checks.map((check) => <p className={check.ready ? "ready" : ""} key={check.label}><b>{check.ready ? "Ready" : "Required"}</b><span>{check.label}<small>{check.detail}</small></span></p>)}<button className="button secondary" onClick={() => void readiness.refresh()}>Check again</button></div>}
        <footer className="maintenance-composer">
          <div className="maintenance-composer-input"><textarea aria-label="Message Maintenance RaDio" disabled={!readiness.ready} value={body} onChange={(event) => { setBody(event.target.value); setPromptImproved(false); }} placeholder={readiness.ready ? "Ask about Asteria health, reports, or maintenance…" : "Complete RaDio setup before chatting"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><span><LightbulbIcon /> {body.trim() ? `${body.trim().split(/\s+/).length} words · Enter to send · Shift + Enter for a new line` : "Describe the outcome; RaDio will inspect before acting."}</span></div>
          <div className="maintenance-composer-actions"><button className={`maintenance-improve-button${promptImproved ? " improved" : ""}`} aria-label={promptImproved ? "Prompt improved" : "Improve prompt"} title={promptImproved ? "Prompt improved" : "Improve prompt locally"} disabled={!body.trim() || !readiness.ready} onClick={() => { setBody(improveMaintenancePrompt(body)); setPromptImproved(true); }}>{promptImproved ? <CheckCircleIcon weight="fill" /> : <MagicWandIcon weight="fill" />}</button><motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: .94 }} aria-label="Send to Maintenance RaDio" disabled={!body.trim() || !readiness.ready || isStreaming} onClick={() => void send()}><ArrowUpIcon weight="bold" /></motion.button></div>
        </footer>
      </section>
      <section className="maintenance-feed">
        <header><div><span className="eyebrow">Health queue</span><h2>Maintenance reports</h2></div><span className={incidents.length ? "warning" : "success"}>{incidents.length ? "Needs review" : "All clear"}</span></header>
        {incidents.length ? incidents.map(({ project, incident }) => <button key={incident.id} onClick={() => onOpenProject(project.id)}><WarningIcon /><span><strong>{incident.title}</strong><small>{project.name} · {incident.owner} Star · {incident.status}</small><p>{incident.detail}</p></span><b>Open Orbit</b></button>) : <div className="maintenance-empty"><CheckCircleIcon weight="duotone" /><h3>No unresolved incidents</h3><p>RaDio is monitoring renderer, Electron, storage, provider, build, installation, and startup health.</p></div>}
      </section>
    </div>
  </div>;
}
