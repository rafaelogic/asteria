import { useEffect, useState } from "react";
import { ChartLineUpIcon, ClockIcon, DatabaseIcon, PlayIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import type { Project, TelemetryEvent, TelemetryPolicy, TelemetrySummary } from "../types";
import { ProviderMark } from "../components/ProviderMark";

const fallbackSummary: TelemetrySummary = {
  totalEvents: 1284, replayEvents: 1284, storageBytes: 312 * 1024 * 1024, quotaBytes: 5 * 1024 ** 3, retentionDays: 30,
  enabled: true, replayEnabled: true, cycleMinutes: 128, approvalWaitMinutes: 14, reviewRejectionRate: .18, qaRejectionRate: .12,
  providerStats: [{ provider: "codex", runs: 14, successRate: .93, avgMinutes: 8.4, cost: 12.82 }, { provider: "claude", runs: 9, successRate: .89, avgMinutes: 10.2, cost: 10.41 }],
  stageStats: [{ stage: "Define", minutes: 12, attempts: 1, outcome: "succeeded" }, { stage: "Design", minutes: 24, attempts: 1, outcome: "succeeded" }, { stage: "Architect", minutes: 18, attempts: 1, outcome: "succeeded" }, { stage: "Build", minutes: 58, attempts: 3, outcome: "started" }, { stage: "Review", minutes: 16, attempts: 2, outcome: "started" }]
};

export function InsightsScreen({ project }: { project: Project }) {
  const [summary, setSummary] = useState(fallbackSummary);
  const [policy, setPolicy] = useState<TelemetryPolicy>({ enabled: true, replayEnabled: true, retentionDays: 30, quotaBytes: 5 * 1024 ** 3 });
  const [replayOpen, setReplayOpen] = useState(false);
  useEffect(() => {
    void window.asteria?.telemetry.summary(project.id).then(setSummary).catch(() => undefined);
    void window.asteria?.telemetry.policy().then(setPolicy).catch(() => undefined);
  }, [project.id]);
  const savePolicy = (next: TelemetryPolicy) => {
    setPolicy(next);
    void window.asteria?.telemetry.updatePolicy(next);
  };
  const storagePercent = Math.min(100, summary.storageBytes / summary.quotaBytes * 100);
  return <div className="screen standard-screen insights-screen">
    <header className="section-header"><div><span className="eyebrow">{project.name} · Local only</span><h1>Local insights</h1><p>Encrypted operational telemetry and full redacted replay. Nothing is uploaded.</p></div><button className="button primary" onClick={() => setReplayOpen(true)}><PlayIcon weight="fill" /> Replay run</button></header>
    <div className="metric-grid"><Metric icon={<ClockIcon />} label="Cycle time" value={`${Math.round(summary.cycleMinutes)}m`} detail={`${Math.round(summary.approvalWaitMinutes)}m awaiting approval`} /><Metric icon={<ChartLineUpIcon />} label="Review pass rate" value={`${Math.round((1-summary.reviewRejectionRate)*100)}%`} detail={`${Math.round(summary.reviewRejectionRate*100)}% returned for iteration`} /><Metric icon={<ShieldCheckIcon />} label="QA pass rate" value={`${Math.round((1-summary.qaRejectionRate)*100)}%`} detail="Targeted rechecks enabled" /><Metric icon={<DatabaseIcon />} label="Replay storage" value={`${(summary.storageBytes / 1024 ** 2).toFixed(0)} MB`} detail={`${summary.totalEvents.toLocaleString()} local events`} /></div>
    <div className="insights-layout"><section className="insight-panel"><header><div><span className="eyebrow">Stage velocity</span><h2>Starpath cycle</h2></div><span className="local-badge">Live</span></header><div className="stage-chart">{summary.stageStats.map((stage) => <div key={stage.stage}><span><strong>{stage.stage}</strong><small>{stage.attempts} {stage.attempts === 1 ? "attempt" : "attempts"}</small></span><i><b style={{ width: `${Math.max(8, Math.min(100, stage.minutes / 60 * 100))}%` }} /></i><em>{Math.round(stage.minutes)}m</em></div>)}</div></section>
      <section className="insight-panel"><header><div><span className="eyebrow">Provider comparison</span><h2>Reliability</h2></div></header><div className="provider-stats">{summary.providerStats.map((item) => <div key={item.provider}><span className={`provider-orb ${item.provider}`}><ProviderMark provider={item.provider} size={20} /></span><span><strong>{item.provider === "codex" ? "OpenAI Codex" : "Claude Code"}</strong><small>{item.runs} sessions · {item.avgMinutes.toFixed(1)}m avg</small></span><b>{Math.round(item.successRate*100)}%</b></div>)}</div></section></div>
    <section className="telemetry-control-panel"><header><div><span className="eyebrow">Collection policy</span><h2>Private by architecture</h2></div><span><ShieldCheckIcon /> No network destination</span></header><div className="control-grid"><Control title="Local telemetry" detail="Metrics and operational events" checked={policy.enabled} onToggle={() => savePolicy({ ...policy, enabled: !policy.enabled })} /><Control title="Full replay" detail="Redacted transcripts and tools" checked={policy.replayEnabled} onToggle={() => savePolicy({ ...policy, replayEnabled: !policy.replayEnabled })} /><div className="storage-control"><span><strong>30-day rolling retention</strong><small>{storagePercent.toFixed(1)}% of 5 GB used</small></span><i><b style={{ width: `${storagePercent}%` }} /></i></div><button className="button secondary" onClick={() => void window.asteria?.telemetry.export(project.id)}>Export redacted data</button></div></section>
    {replayOpen && <ReplayModal project={project} onClose={() => setReplayOpen(false)} />}
  </div>;
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <section className="metric-card"><span>{icon}</span><small>{label}</small><strong>{value}</strong><p>{detail}</p></section>; }
function Control({ title, detail, checked, onToggle }: { title: string; detail: string; checked: boolean; onToggle: () => void }) { return <button className="toggle-row" onClick={onToggle}><span><strong>{title}</strong><small>{detail}</small></span><i className={checked ? "toggle on" : "toggle"}><b /></i></button>; }
function ReplayModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [frames, setFrames] = useState<TelemetryEvent[]>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    void window.asteria?.telemetry.replay(project.id, project.runId).then((bundle) => setFrames(bundle.frames)).catch(() => undefined);
  }, [project.id, project.runId]);
  const display = frames.length ? frames : project.events.map((event, index) => ({ id: event.id, schemaVersion: 1, projectId: project.id, runId: project.runId, sequence: index + 1, monotonicMs: index * 1000, timestamp: event.timestamp, correlationId: event.id, kind: "workflow" as const, name: event.title, payload: { detail: event.detail }, redacted: true as const }));
  const frame = display[active];
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="replay-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><header><div><span className="eyebrow">Run replay</span><h2>{project.name}</h2></div><button className="icon-button" onClick={onClose}>×</button></header><div className="replay-stage"><div className="replay-orbit"><PlayIcon weight="fill" /></div><span><small>Frame {active + 1} of {display.length}</small><h3>{frame?.name ?? "No replay frames yet"}</h3><p>{String(frame?.payload.detail ?? "Telemetry will appear as specialists begin work.")}</p></span></div><input className="replay-range" type="range" min="0" max={Math.max(0, display.length - 1)} value={active} onChange={(event) => setActive(Number(event.target.value))} /><footer><span>Redacted before persistence</span><button className="button primary" onClick={() => setActive((value) => Math.min(display.length - 1, value + 1))}>Next frame <PlayIcon /></button></footer></section></div>;
}
