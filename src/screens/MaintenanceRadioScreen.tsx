import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import {
  ActivityIcon, ArrowLeftIcon, ArrowUpIcon, BrainIcon, CheckCircleIcon, CoffeeIcon, FolderOpenIcon,
  GitBranchIcon, MagicWandIcon, PauseIcon, PlayIcon, RobotIcon, SlidersHorizontalIcon, StopCircleIcon,
  TargetIcon, WarningIcon, XIcon
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { Brand } from "../components/Brand";
import { SafeMarkdownPreview } from "../components/RichPreview";
import { ResponseActivity } from "../components/ResponseActivity";
import { useConversationAutoScroll } from "../hooks/useConversationAutoScroll";
import { useRadioReadiness } from "../hooks/useRadioReadiness";
import type { ApplicationMaintenanceSettings, MaintenancePanel, Project, UserInstallState } from "../types";

const MaintenanceMarkdown = memo(SafeMarkdownPreview);

const panels: Array<{ id: MaintenancePanel; label: string; icon: typeof TargetIcon }> = [
  { id: "goals", label: "Goals", icon: TargetIcon },
  { id: "activity", label: "Activity", icon: ActivityIcon },
  { id: "findings", label: "Findings", icon: WarningIcon },
  { id: "staging", label: "Staging", icon: GitBranchIcon },
  { id: "automation", label: "Automation", icon: SlidersHorizontalIcon },
];

const radialPositions: Record<MaintenancePanel, { x: string; y: string }> = {
  goals: { x: "32%", y: "55%" }, activity: { x: "46%", y: "24%" }, findings: { x: "64%", y: "39%" },
  staging: { x: "64%", y: "68%" }, automation: { x: "46%", y: "79%" },
};

const neuralNodes: Record<MaintenancePanel, Array<{ label: string; detail: string }>> = {
  goals: [{ label: "Queue", detail: "Objectives waiting for activation" }, { label: "Active", detail: "Current ownership and execution" }, { label: "Resolved", detail: "Completed objective evidence" }],
  activity: [{ label: "Current pulse", detail: "What RaDio is doing now" }, { label: "Relay", detail: "Provider and Star ownership" }, { label: "Recent stream", detail: "Latest operational events" }],
  findings: [{ label: "Alerts", detail: "Unresolved application findings" }, { label: "Evidence", detail: "Observed and verified signals" }, { label: "Diagnosis", detail: "Likely causes and next checks" }],
  staging: [{ label: "Branches", detail: "Isolated change locations" }, { label: "Verification", detail: "Checks attached to revisions" }, { label: "Promotion", detail: "Release readiness and blockers" }],
  automation: [{ label: "Cycle", detail: "Inspection cadence and state" }, { label: "Authority", detail: "Execution and approval boundaries" }, { label: "Runtime", detail: "Source, Relay, and installation" }],
};

type Point = { x: number; y: number };
type ConnectorGeometry = { width: number; height: number; core: Point; controls: Record<MaintenancePanel, Point>; panel?: Point };

export function neuralConnectorPath(from: Point, to: Point) {
  const bend = Math.max(42, Math.abs(to.x - from.x) * .42);
  const direction = to.x >= from.x ? 1 : -1;
  return `M${from.x} ${from.y} C${from.x + bend * direction} ${from.y} ${to.x - bend * direction} ${to.y} ${to.x} ${to.y}`;
}

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

function NeuralBrain({ state, theme, target }: { state?: ApplicationMaintenanceSettings; theme: MaintenancePanel | "idle"; target?: MaintenancePanel }) {
  const active = state?.automation.status ?? "idle";
  const working = ["inspecting", "implementing", "verifying", "staging"].includes(active);
  const signalPaths: Record<MaintenancePanel, string> = {
    goals: "M250 270 C205 268 170 242 138 214 C95 176 52 182 8 210",
    activity: "M250 150 C250 112 250 62 250 8",
    findings: "M330 210 C374 192 410 165 474 145",
    staging: "M330 210 C370 248 410 278 476 294",
    automation: "M250 270 C250 312 250 360 250 412",
  };
  return <div className={`neural-brain theme-${theme} state-${active}${working ? " working" : ""}${target ? ` signal-${target}` : ""}`} role="img" aria-label={`RaDio is ${active}${target ? `; neural signal targets ${target}` : ""}. ${state?.automation.idleStatus ?? "Waiting for application state."}`}>
    <svg viewBox="0 0 500 420" aria-hidden="true">
      <defs><filter id="neural-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <g className="core-orbits">
        <circle cx="250" cy="210" r="190" /><circle cx="250" cy="210" r="166" /><circle cx="250" cy="210" r="126" />
        <path d="M250 20v18M250 382v18M60 210h18M422 210h18M116 76l13 13M371 331l13 13M116 344l13-13M371 89l13-13" />
      </g>
      <g className="neural-links">
        {["70,210 140,120 245,90 360,125 430,215","70,210 145,300 250,330 365,295 430,215","140,120 175,205 245,90 330,210 360,125","145,300 175,205 250,330 330,210 365,295","175,205 250,150 330,210 250,270 175,205","250,90 250,150 250,270 250,330"].map((points) => <polyline key={points} points={points} />)}
      </g>
      <path className="brain-outline" d="M247 53c-45-31-112 0-112 53-55 2-77 68-42 104-34 45-6 105 43 108 9 52 74 69 111 34 38 35 103 18 112-34 49-3 77-63 43-108 35-36 13-102-42-104 0-53-68-84-113-53Z" />
      <path className="brain-split" d="M247 54v298" />
      <g className="neural-nodes">{[[70,210],[140,120],[245,90],[360,125],[430,215],[145,300],[250,330],[365,295],[175,205],[250,150],[330,210],[250,270]].map(([cx,cy], index) => <circle key={index} cx={cx} cy={cy} r={index % 3 === 0 ? 8 : 5} />)}</g>
      {target && <g className={`neural-signal neural-signal-${target}`}>
        <path className="neural-signal-track" d={signalPaths[target]} />
        <path className="neural-signal-light" d={signalPaths[target]} />
      </g>}
    </svg>
    <div className="neural-core-readout" aria-hidden="true"><small>RaDio core</small><strong>{active}</strong><span>{working ? "Live execution" : "System ready"}</span></div>
  </div>;
}

export function MaintenanceRadioScreen({ projects, onReturn }: { projects: Project[]; onReturn: () => void }) {
  const [install, setInstall] = useState<UserInstallState>({ rollbackReady: false });
  const [state, setState] = useState<ApplicationMaintenanceSettings>();
  const [panel, setPanel] = useState<MaintenancePanel>();
  const [selectedNode, setSelectedNode] = useState<number>();
  const [chatOpen, setChatOpen] = useState(false);
  const [body, setBody] = useState("");
  const [selectedOrbit, setSelectedOrbit] = useState("");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const expansionRef = useRef<HTMLElement>(null);
  const [connectors, setConnectors] = useState<ConnectorGeometry>();
  const { messagesRef, handleMessagesScroll, resumeAutoScroll, hasNewMessages } = useConversationAutoScroll(state?.chat.messages);
  const readiness = useRadioReadiness(state?.provider ?? "codex");
  const activeGoal = state?.goals.find((goal) => goal.id === state.activeGoalId);
  const localOrbits = projects.filter((project) => project.repositoryPath);
  const isStreaming = state?.chat.messages.some((message) => message.status === "streaming") ?? false;
  const operationalState = state?.automation.status ?? "idle";
  const isWorking = isStreaming || ["inspecting", "implementing", "verifying", "staging", "installing", "relaunching"].includes(operationalState);
  const latestCard = state?.chat.messages.flatMap((message) => message.cards).at(-1);
  const activityStartedAt = activeGoal?.updatedAt ? new Date(activeGoal.updatedAt).getTime() : clock;
  const elapsedSeconds = Math.max(0, Math.floor((clock - activityStartedAt) / 1000));
  const operationalTarget: MaintenancePanel | undefined = state?.automation.emergencyStopped || ["blocked", "failed"].includes(operationalState)
    ? "findings"
    : state?.automation.cycleRunning
      ? "automation"
      : operationalState === "staging"
        ? "staging"
        : ["inspecting", "implementing", "verifying", "installing", "relaunching"].includes(operationalState) || isStreaming
          ? "activity"
          : activeGoal?.status === "queued"
            ? "goals"
            : undefined;
  const issueGoal = activeGoal && ["blocked", "failed"].includes(activeGoal.status) ? activeGoal : undefined;
  const issueFinding = issueGoal ? state?.findings.find((finding) => finding.goalId === issueGoal.id && ["critical", "error"].includes(finding.severity)) : undefined;
  const hasIssue = Boolean(state?.automation.emergencyStopped || ["blocked", "failed"].includes(operationalState) || issueGoal);
  const issueReason = state?.automation.emergencyStopped
    ? "Emergency stop is active. Resume only after reviewing the interrupted operation."
    : issueGoal?.blocker ?? issueGoal?.currentAction ?? issueFinding?.detail ?? error;

  useEffect(() => {
    void window.asteria?.installer.state().then(setInstall);
    void window.asteria?.maintenance.state().then((value) => { setState(value); setPanel(value.selectedPanel); });
    return window.asteria?.maintenance.subscribe(setState);
  }, []);
  useEffect(() => {
    const pop = (event: PopStateEvent) => setPanel((event.state as { radioPanel?: MaintenancePanel } | null)?.radioPanel);
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (panel) void choosePanel(undefined, false);
      else if (chatOpen) setChatOpen(false);
      else onReturn();
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("popstate", pop); window.removeEventListener("keydown", key); };
  });
  useEffect(() => {
    if (!isWorking) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [isWorking]);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const stageBox = stage.getBoundingClientRect();
      const controls = {} as Record<MaintenancePanel, Point>;
      for (const item of panels) {
        const button = stage.querySelector<HTMLButtonElement>(`.radial-controls [data-panel="${item.id}"]`);
        if (!button) return;
        const box = button.getBoundingClientRect();
        controls[item.id] = { x: box.left + box.width / 2 - stageBox.left, y: box.top + box.height / 2 - stageBox.top };
      }
      const expansion = expansionRef.current?.getBoundingClientRect();
      setConnectors({
        width: stageBox.width,
        height: stageBox.height,
        core: { x: stageBox.width / 2, y: stageBox.height / 2 },
        controls,
        panel: expansion ? { x: expansion.left - stageBox.left, y: expansion.top - stageBox.top + Math.min(115, expansion.height / 2) } : undefined,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    if (expansionRef.current) observer.observe(expansionRef.current);
    const frame = requestAnimationFrame(measure);
    const settled = window.setTimeout(measure, 360);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.clearTimeout(settled); };
  }, [panel]);

  const choosePanel = async (next?: MaintenancePanel, push = true) => {
    setPanel(next);
    setSelectedNode(next ? 0 : undefined);
    if (push) window.history.pushState({ ...(window.history.state ?? {}), radioPanel: next }, "");
    if (window.asteria && state) {
      try {
        const latest = await window.asteria.maintenance.state();
        setState(await window.asteria.maintenance.selectPanel({ expectedVersion: latest.version, idempotencyKey: `panel_${crypto.randomUUID()}`, panel: next }));
      } catch (value) {
        setError(value instanceof Error ? value.message : `The ${next ?? "console"} panel could not be opened.`);
      }
    }
  };
  const handleStageClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    const control = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(".radial-controls button")].find((button) => {
      const bounds = button.getBoundingClientRect();
      return event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    });
    const next = control?.dataset.panel as MaintenancePanel | undefined;
    if (next) void choosePanel(panel === next ? undefined : next);
  };
  const control = async (action: "run" | "pause" | "resume" | "emergency-stop" | "toggle-auto-install") => {
    if (!window.asteria || !state) return;
    setError("");
    try { setState(await window.asteria.maintenance.control({ expectedVersion: state.version, idempotencyKey: `automation_${crypto.randomUUID()}`, action })); }
    catch (value) { setError(value instanceof Error ? value.message : "Automation control failed."); }
  };
  const goalAction = async (goalId: string, action: "cancel" | "retry" | "prioritize") => {
    if (!window.asteria || !state) return;
    setState(await window.asteria.maintenance.goal({ expectedVersion: state.version, idempotencyKey: `goal_${crypto.randomUUID()}`, goalId, action }));
  };
  const send = async () => {
    if (!window.asteria || !state || !body.trim() || !readiness.ready) return;
    resumeAutoScroll(); setError("");
    const submitted = body;
    try {
      const latest = await window.asteria.maintenance.state();
      setState(await window.asteria.maintenance.send({ expectedVersion: latest.version, idempotencyKey: `maintenance_${crypto.randomUUID()}`, operationId: crypto.randomUUID(), body: submitted }));
      setBody("");
    } catch (value) { setError(value instanceof Error ? value.message : "RaDio could not send this prompt."); }
  };
  const selectSource = async (source: "folder" | "orbit") => {
    if (!window.asteria || !state?.pendingOperation) return;
    setState(await window.asteria.maintenance.selectSource({ expectedVersion: state.version, idempotencyKey: `source_${crypto.randomUUID()}`, operationId: state.pendingOperation.operationId, source, projectId: source === "orbit" ? selectedOrbit : undefined }));
  };
  const nextCycle = state?.automation.nextCycleAt ? new Date(state.automation.nextCycleAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "after startup";
  const theme = panel ?? "idle";

  return <div className={`neural-console theme-${theme}${isWorking ? " has-active-work" : ""}${hasIssue ? " has-issue" : ""}`}>
    <header className="neural-topbar">
      <Brand />
      <div className="neural-state"><span><small>Next cycle</small><strong>{nextCycle}</strong></span></div>
      <div className="neural-command-status" role="status" aria-label={`RaDio ${operationalState}`}>
        {(state?.automation.paused || state?.automation.emergencyStopped) && <CoffeeIcon weight="duotone" aria-label="RaDio is paused" />}
        <i /><span><small>RaDio core</small><strong>{state?.automation.emergencyStopped ? "Stopped" : state?.automation.paused ? "Paused" : operationalState}</strong></span>
        {!isWorking && !state?.automation.paused && !state?.automation.emergencyStopped && <button className="neural-activate-control" disabled={!state || state.automation.cycleRunning} onClick={() => void control("run")}><PlayIcon /> {state?.automation.lastCycleAt ? "Inspect now" : "Activate"}</button>}
        <button className="icon-control" aria-label={state?.automation.paused ? "Resume automation" : "Pause automation"} title={state?.automation.paused ? "Resume automation" : "Pause automation"} onClick={() => void control(state?.automation.paused ? "resume" : "pause")}>{state?.automation.paused ? <PlayIcon /> : <PauseIcon />}</button>
        <button className="icon-control danger" aria-label="Emergency stop" title="Emergency stop" onClick={() => void control("emergency-stop")}><StopCircleIcon /></button>
      </div>
      <div className="version-chip"><small>Installed / source</small><strong>{install.currentVersion ?? "dev"} / {state?.source?.version ?? "not selected"}</strong></div>
      <div className="neural-top-actions"><button className="button secondary" onClick={onReturn}><ArrowLeftIcon /> All projects</button></div>
    </header>

    <main ref={stageRef} className="neural-stage" onClick={handleStageClick}>
      <div className="neural-heading"><span className="eyebrow">Application-level autonomous core</span><h1>Neural Console</h1><p>{activeGoal ? activeGoal.currentAction : state?.automation.idleStatus ?? "Initializing local inspection"}</p></div>
      <aside className="neural-hud-rail neural-mission-rail" aria-label="Current mission context">
        <header><TargetIcon weight="duotone" /><span><small>Current directive</small><strong>{activeGoal?.title ?? "Maintain Asteria"}</strong></span><b>{activeGoal?.status ?? "ready"}</b></header>
        <dl><div><dt>Active owner</dt><dd>{activeGoal?.assignedStar ?? "RaDio"}</dd></div><div><dt>Source binding</dt><dd>{state?.source?.repository ?? "Not selected"}</dd></div><div><dt>Goal queue</dt><dd>{state?.goals.length ?? 0} objectives</dd></div></dl>
        <p>{activeGoal?.currentAction ?? state?.automation.idleStatus ?? "Waiting for application state."}</p>
      </aside>
      <aside className="neural-hud-rail neural-queue-rail" aria-label="Goal queue processes">
        <header><BrainIcon weight="duotone" /><span><small>Goal queue</small><strong>{state?.goals.length ?? 0} tracked processes</strong></span><b>{state?.goals.filter((goal) => !["completed", "cancelled"].includes(goal.status)).length} open</b></header>
        <div className="neural-queue-list">{state?.goals.slice(0, 5).map((goal) => <button key={goal.id} onClick={() => { void choosePanel("goals"); setSelectedNode(goal.status === "completed" || goal.status === "cancelled" ? 2 : goal.status === "queued" ? 0 : 1); }}><i className={`status-${goal.status}`} /><span><strong>{goal.title}</strong><small>{goal.assignedStar} · {goal.status}</small></span><em>P{goal.priority}</em></button>)}{!state?.goals.length && <p>No maintenance processes are queued.</p>}</div>
      </aside>
      {!panel && <aside className="neural-hud-rail neural-system-rail" aria-label="System telemetry">
        <header><ActivityIcon weight="duotone" /><span><small>System telemetry</small><strong>Local control plane</strong></span><b>{readiness.ready ? "online" : "limited"}</b></header>
        <div className="neural-telemetry-grid"><Metric label="Relay" value={readiness.ready ? `${state?.provider ?? "Codex"} ready` : "Unavailable"} /><Metric label="Findings" value={`${state?.findings.length ?? 0} open`} /><Metric label="Cycle" value={state?.automation.cycleRunning ? "Running" : nextCycle} /><Metric label="Install" value={install.currentVersion ?? "dev"} /></div>
      </aside>}
      <NeuralBrain state={state} theme={theme} target={operationalTarget} />
      {connectors && <svg className="neural-command-links" viewBox={`0 0 ${connectors.width} ${connectors.height}`} aria-hidden="true">
        <g className="core-section-links">{panels.map(({ id }) => <path key={id} className={`link-${id}`} d={neuralConnectorPath(connectors.core, connectors.controls[id])} />)}</g>
        {panel && connectors.panel && <path className={`command-bay-link link-${panel}`} d={neuralConnectorPath(connectors.controls[panel], connectors.panel)} />}
      </svg>}
      {hasIssue && <aside className="neural-issue-readout" role="alert"><WarningIcon weight="fill" /><span><small>{state?.automation.emergencyStopped ? "Emergency stop" : "Execution blocked"}</small><strong>{issueGoal?.title ?? issueFinding?.title ?? "RaDio needs attention"}</strong><p>{issueReason || "Inspect Findings for the latest failure evidence."}</p></span><button onClick={() => void choosePanel("findings")}>Inspect findings</button></aside>}
      <AnimatePresence>{isWorking && <motion.button className="activity-thought" aria-label="Open live activity" onClick={() => void choosePanel("activity")} initial={{ opacity: 0, scale: .75, x: -20, y: 12 }} animate={{ opacity: 1, scale: 1, x: 0, y: 0 }} exit={{ opacity: 0, scale: .82, x: -12 }} transition={{ type: "spring", stiffness: 240, damping: 20 }}>
        <i className="thought-tail tail-one" /><i className="thought-tail tail-two" />
        <span className="thought-icon"><ActivityIcon weight="bold" /></span>
        <span className="thought-copy"><small><b /> Live activity · {operationalState}</small><strong>{activeGoal?.currentAction ?? (isStreaming ? "RaDio is responding" : "Processing application state")}</strong><em>{activeGoal?.assignedStar ?? "RaDio"} · {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}{latestCard ? ` · ${latestCard.title}` : ""}</em></span>
        <span className="thought-wave"><i /><i /><i /></span>
      </motion.button>}</AnimatePresence>
      <nav className="radial-controls" aria-label="RaDio console sections">{panels.map(({ id, label, icon: Icon }, index) => {
        const selected = panel === id;
        const operational = operationalTarget === id;
        const position = radialPositions[id];
        return <button key={id} data-panel={id} style={{ "--slot": index, "--x": position.x, "--y": position.y } as CSSProperties} className={`radial-${id}${selected ? " active" : ""}${operational ? " operational" : ""}`} onClick={() => void choosePanel(selected ? undefined : id)} aria-label={`${selected ? "Close" : "Open"} ${label}${operational ? ", current operational target" : ""}`} aria-expanded={selected} aria-pressed={selected} title={label}>
          <span className="radial-control-face"><span className="radial-control-icon"><Icon weight={selected || operational ? "fill" : "duotone"} /></span><span className="radial-control-label">{label}</span><i className="radial-active-marker" aria-hidden="true" /></span>
        </button>;
      })}</nav>
      <AnimatePresence mode="wait">{panel && <motion.section ref={expansionRef} key={panel} className={`neural-expansion expansion-${panel}`} aria-label={`${panels.find((item) => item.id === panel)?.label} neural network`} initial={{ opacity: 0, x: 28, scale: .96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 18, scale: .97 }} transition={{ type: "spring", stiffness: 260, damping: 25 }}>
        <svg className="neural-expansion-links" viewBox="0 0 420 250" aria-hidden="true"><path d="M38 125 C118 125 116 42 210 42 M38 125 C120 125 126 125 210 125 M38 125 C118 125 116 208 210 208" /></svg>
        <div className="neural-expansion-origin"><BrainIcon weight="duotone" /><span>{panels.find((item) => item.id === panel)?.label}</span></div>
        <div className="neural-expansion-nodes">{neuralNodes[panel].map((node, index) => <button key={node.label} className={selectedNode === index ? "selected" : ""} onClick={() => setSelectedNode(index)} aria-label={`Inspect ${node.label}`}><i /><span><strong>{node.label}</strong><small>{node.detail}</small></span></button>)}</div>
        <AnimatePresence>{selectedNode !== undefined && <motion.aside className="neural-thought-detail" initial={{ opacity: 0, x: -16, scale: .94 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -10 }}>
          <header><span><small>Neural thought · {panels.find((item) => item.id === panel)?.label}</small><strong>{neuralNodes[panel][selectedNode].label}</strong><em>{neuralNodes[panel][selectedNode].detail}</em></span><button aria-label="Close thought detail" onClick={() => setSelectedNode(undefined)}><XIcon /></button></header>
          <div className="radial-card-body"><ThoughtContent panel={panel} node={selectedNode} state={state} activeGoal={activeGoal} readinessReady={readiness.ready} onGoalAction={goalAction} onControl={control} /></div>
        </motion.aside>}</AnimatePresence>
      </motion.section>}</AnimatePresence>
    </main>

    <motion.section className={chatOpen ? "neural-chat open" : "neural-chat"} initial={false} animate={chatOpen ? { top: 92, left: "12vw", right: "12vw", bottom: 18, borderRadius: 20 } : { top: "calc(100% - 73px)", left: 22, right: 22, bottom: 18, borderRadius: 15 }} transition={{ type: "spring", stiffness: 210, damping: 28, mass: .9 }}>
      <AnimatePresence initial={false} mode="popLayout">{!chatOpen ? <motion.button key="launcher" className="prompt-launcher" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} transition={{ duration: .16 }} onClick={() => { setChatOpen(true); window.setTimeout(() => { resumeAutoScroll(); promptRef.current?.focus(); }, 260); }}><BrainIcon weight="duotone" /><span>Ask RaDio about Asteria maintenance…</span><kbd>⌘ K</kbd></motion.button> : <motion.div key="conversation" className="neural-chat-expanded" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ delay: .1, duration: .24 }}>
        <header><div><RobotIcon weight="duotone" /><span><strong>Maintenance conversations</strong><small>Application scope · encrypted locally</small></span></div><select aria-label="Current conversation"><option>Current thread</option></select><button className="button secondary" onClick={() => setBody("")}>New conversation</button><button className="icon-control" aria-label="Collapse conversation" onClick={() => setChatOpen(false)}><XIcon /></button></header>
        <div className="neural-messages" ref={messagesRef} onScroll={handleMessagesScroll}>{state?.chat.messages.map((message) => <article key={message.id} className={message.author}><span>{message.author === "radio" ? <RobotIcon /> : "You"}</span><div className="neural-message-content"><header><strong>{message.author === "radio" ? "RaDio" : "You"}</strong><small>{message.status.replaceAll("_", " ")}</small></header>{message.body && <MaintenanceMarkdown content={message.body} fallbackLabel="Showing plain response" />}{message.status === "streaming" && <><ResponseActivity hasContent={Boolean(message.body)} /><button className="text-button" onClick={() => state && void window.asteria?.maintenance.cancel({ expectedVersion: state.version, idempotencyKey: `cancel_${crypto.randomUUID()}`, messageId: message.id })}><StopCircleIcon /> Stop</button></>}{message.status === "waiting_for_source" && <div className="source-required-card"><FolderOpenIcon /><div><strong>Asteria source required</strong><p>Changes run only in an isolated internal worktree.</p><button className="button primary" onClick={() => void selectSource("folder")}>Choose Asteria repository</button>{localOrbits.length > 0 && <div className="source-orbit-row"><select value={selectedOrbit} onChange={(event) => setSelectedOrbit(event.target.value)}><option value="">Choose local Orbit…</option>{localOrbits.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select><button disabled={!selectedOrbit} onClick={() => void selectSource("orbit")}>Use Orbit</button></div>}</div></div>}</div></article>)}</div>
        {hasNewMessages && <button className="jump-to-latest" onClick={resumeAutoScroll}><ArrowUpIcon /> Latest message</button>}
        {error && <p className="radio-send-error" role="alert">{error}</p>}
        <footer><textarea ref={promptRef} aria-label="Maintenance prompt" value={body} onChange={(event) => setBody(event.target.value)} placeholder={readiness.ready ? "Ask, diagnose, or create a durable maintenance goal…" : "Provider unavailable; local inspection remains available"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><button className="icon-control improve" aria-label="Improve prompt" title="Improve prompt locally" onClick={() => setBody(improveMaintenancePrompt(body))}><MagicWandIcon /></button><button className="send-control" aria-label="Send prompt" disabled={!body.trim() || !readiness.ready || isStreaming} onClick={() => void send()}><ArrowUpIcon /></button></footer>
      </motion.div>}</AnimatePresence>
    </motion.section>
  </div>;
}

function ThoughtContent({ panel, node = 0, state, activeGoal, readinessReady, onGoalAction, onControl }: {
  panel: MaintenancePanel;
  node?: number;
  state?: ApplicationMaintenanceSettings;
  activeGoal?: ApplicationMaintenanceSettings["goals"][number];
  readinessReady: boolean;
  onGoalAction: (goalId: string, action: "cancel" | "retry" | "prioritize") => Promise<void>;
  onControl: (action: "run" | "pause" | "resume" | "emergency-stop" | "toggle-auto-install") => Promise<void>;
}) {
  const goals = state?.goals ?? [];
  const findings = state?.findings ?? [];
  if (panel === "goals") {
    const scoped = node === 0
      ? goals.filter((goal) => goal.status === "queued" || goal.status === "blocked")
      : node === 1
        ? goals.filter((goal) => ["inspecting", "implementing", "verifying", "staging", "installing", "relaunching", "failed"].includes(goal.status))
        : goals.filter((goal) => ["completed", "cancelled"].includes(goal.status));
    return <>{scoped.length ? scoped.map((goal) => <article className="console-row" key={goal.id}><span><strong>{goal.title}</strong><small>P{goal.priority} · {goal.assignedStar} · {goal.status}</small><p>{goal.blocker ?? goal.currentAction}</p><em>{goal.rationale}</em></span><div>{goal.status === "blocked" && <button onClick={() => void onGoalAction(goal.id, "retry")}>Retry</button>}<button onClick={() => void onGoalAction(goal.id, "prioritize")}>Prioritize</button></div></article>) : <Empty label={node === 0 ? "No queued goals" : node === 1 ? "No goals currently executing" : "No resolved goals yet"} />}</>;
  }
  if (panel === "activity") {
    if (node === 0) return activeGoal ? <article className="activity-focus"><ActivityIcon /><span><small>Active Star · {activeGoal.assignedStar}</small><strong>{activeGoal.title}</strong><p>{activeGoal.blocker ?? activeGoal.currentAction}</p><b>{activeGoal.attempts}/3 attempts · P{activeGoal.priority}</b></span></article> : <Empty label="No active execution" />;
    if (node === 1) return <div className="automation-grid"><Metric label="RaDio identity" value="Executive coordinator" /><Metric label="Active Star" value={activeGoal?.assignedStar ?? "None"} /><Metric label="Relay" value={readinessReady ? `${state?.provider ?? "Codex"} ready` : "Unavailable"} /><Metric label="Operation" value={state?.automation.status ?? "Starting"} /></div>;
    return <>{state?.chat.messages.slice(-8).reverse().map((message) => <article className="console-row" key={message.id}><span><strong>{message.author === "radio" ? "RaDio response" : "Owner prompt"}</strong><small>{message.status} · {new Date(message.createdAt).toLocaleTimeString()}</small><p>{message.body.slice(0, 150) || "Waiting for content"}</p></span></article>)}</>;
  }
  if (panel === "findings") {
    if (node === 0) {
      const alerts = findings.filter((finding) => finding.severity !== "info");
      return <>{alerts.length ? alerts.map((finding) => <FindingRow key={finding.id} finding={finding} />) : <Empty label="No warning or error alerts" />}</>;
    }
    if (node === 1) return <>{findings.length ? findings.map((finding) => <article className="console-row" key={finding.id}><CheckCircleIcon /><span><strong>{finding.title}</strong><small>Observed {new Date(finding.observedAt).toLocaleString()}</small><p>{finding.detail}</p><code>{finding.fingerprint.slice(0, 24)}</code></span></article>) : <Empty label="No observed evidence" />}</>;
    const diagnoses = goals.filter((goal) => goal.blocker || goal.findings.length);
    return <>{diagnoses.length ? diagnoses.map((goal) => <article className="console-row severity-error" key={goal.id}><WarningIcon /><span><strong>{goal.title}</strong><small>{goal.status} · {goal.assignedStar}</small><p>{goal.blocker ?? goal.findings.join(" · ")}</p><em>Next: {goal.currentAction}</em></span></article>) : <Empty label="No active diagnoses" />}</>;
  }
  if (panel === "staging") {
    if (node === 0) {
      const branches = goals.filter((goal) => goal.branch || goal.worktreePath);
      return <>{branches.length ? branches.map((goal) => <article className="console-row" key={goal.id}><GitBranchIcon /><span><strong>{goal.branch ?? "Isolated worktree"}</strong><small>{goal.assignedStar} · {goal.status}</small><p>{goal.worktreePath ?? goal.currentAction}</p></span></article>) : <Empty label="No isolated branches" />}</>;
    }
    if (node === 1) {
      const verified = goals.filter((goal) => goal.validation?.length || goal.commit);
      return <>{verified.length ? verified.map((goal) => <article className="console-row" key={goal.id}><CheckCircleIcon /><span><strong>{goal.title}</strong><small>{goal.commit?.slice(0, 12) ?? "Pending revision"}</small><p>{goal.validation?.join(" · ") ?? "Revision checkpoint recorded"}</p></span></article>) : <Empty label="No revision verification yet" />}</>;
    }
    const promotions = goals.filter((goal) => goal.staging || goal.install);
    return <>{promotions.length ? promotions.map((goal) => <article className="console-row" key={goal.id}><GitBranchIcon /><span><strong>{goal.staging?.status ?? goal.install?.status ?? goal.status}</strong><small>{goal.install?.version ?? goal.commit?.slice(0, 12) ?? "Promotion pending"}</small><p>{goal.staging?.detail ?? goal.currentAction}</p></span></article>) : <Empty label="No staging promotions yet" />}</>;
  }
  if (node === 0) return <div className="automation-grid"><Metric label="Startup cycle" value={state?.automation.startupInspection ? "Enabled" : "Disabled"} /><Metric label="Schedule" value={`Every ${state?.automation.intervalMinutes ?? 30} min`} /><Metric label="Last cycle" value={state?.automation.lastCycleAt ? new Date(state.automation.lastCycleAt).toLocaleTimeString() : "Not run"} /><Metric label="Next cycle" value={state?.automation.nextCycleAt ? new Date(state.automation.nextCycleAt).toLocaleTimeString() : "After startup"} /><button className="button primary" disabled={!state || state.automation.cycleRunning} onClick={() => void onControl("run")}><PlayIcon /> Run inspection now</button></div>;
  if (node === 1) return <div className="automation-grid"><Metric label="Automation" value={state?.automation.enabled ? "Enabled" : "Disabled"} /><Metric label="Authority" value={state?.automation.emergencyStopped ? "Emergency stopped" : state?.automation.paused ? "Paused by owner" : "Available"} /><Metric label="Self-install" value={state?.automation.autoInstall ? "Verified revisions" : "Disabled"} /><Metric label="Daily features" value={`${state?.automation.dailyFeatureLimit ?? 1} maximum`} /><button className="button secondary" onClick={() => void onControl("toggle-auto-install")}>{state?.automation.autoInstall ? "Disable self-install" : "Enable self-install"}</button></div>;
  return <div className="automation-grid"><Metric label="Source binding" value={state?.source?.repository ?? "Required"} /><Metric label="Source version" value={state?.source?.version ?? "Unavailable"} /><Metric label="Provider" value={readinessReady ? `${state?.provider ?? "Codex"} ready` : "Unavailable"} /><Metric label="Runtime" value={state?.automation.status ?? "Starting"} /></div>;
}

function FindingRow({ finding }: { finding: ApplicationMaintenanceSettings["findings"][number] }) {
  return <article className={`console-row severity-${finding.severity}`}><WarningIcon /><span><strong>{finding.title}</strong><small>{finding.category} · {finding.severity}</small><p>{finding.detail}</p></span></article>;
}

function Empty({ label }: { label: string }) { return <div className="console-empty"><CheckCircleIcon weight="duotone" /><span>{label}</span></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <article><small>{label}</small><strong>{value}</strong></article>; }
