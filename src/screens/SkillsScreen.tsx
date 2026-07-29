import { useEffect, useMemo, useState } from "react";
import { BrainIcon, CheckCircleIcon, CubeIcon, ExportIcon, ShieldCheckIcon, SparkleIcon, StopCircleIcon, WarningIcon } from "@phosphor-icons/react";
import type { Project, RaDioMemoryEntry, SkillRecord } from "../types";

export function SkillsScreen({ project, onProject }: { project: Project; onProject: (project: Project) => void }) {
  const [records, setRecords] = useState<SkillRecord[]>([]);
  const [memory, setMemory] = useState<RaDioMemoryEntry[]>([]);
  const [selected, setSelected] = useState<SkillRecord | null>(null);
  const [editingMemory, setEditingMemory] = useState<RaDioMemoryEntry | null>(null);
  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryValue, setMemoryValue] = useState("");
  const base = { projectId: project.id, runId: project.runId, expectedVersion: project.version };

  const refresh = () => {
    void window.asteria?.skills.list(project.id).then(setRecords);
    void window.asteria?.skills.memory(project.id).then(setMemory);
  };
  useEffect(refresh, [project.id, project.version, project.radio.memoryEnabled, project.radio.ownerMemoryEnabled]);

  const configure = async (record: SkillRecord, enabled: boolean) => {
    if (!window.asteria) return;
    const updated = await window.asteria.skills.configure({
      ...base, idempotencyKey: `skill_${crypto.randomUUID()}`, skillId: record.manifest.id, enabled,
      approvedDigest: enabled && record.manifest.source === "orbit" ? record.manifest.integrity : undefined
    });
    onProject(updated);
  };
  const saveRadio = async (patch: Partial<Project["radio"]>) => {
    const settings = { ...project.radio, ...patch };
    if (window.asteria) onProject(await window.asteria.radio.updateSettings({ ...base, idempotencyKey: `skill_settings_${crypto.randomUUID()}`, settings }));
  };
  const cancel = async (executionId: string) => {
    if (window.asteria) onProject(await window.asteria.skills.cancel({ ...base, idempotencyKey: `skill_cancel_${crypto.randomUUID()}`, executionId }));
  };
  const saveMemory = async () => {
    if (!window.asteria || !memoryTitle.trim() || !memoryValue.trim()) return;
    await window.asteria.skills.remember({ ...base, idempotencyKey: `memory_${crypto.randomUUID()}`, memoryId: editingMemory?.id, entry: { scope: "orbit", kind: editingMemory?.kind ?? "preference", title: memoryTitle.trim(), value: memoryValue.trim(), confidence: editingMemory?.confidence ?? .8 } });
    setEditingMemory(null); setMemoryTitle(""); setMemoryValue(""); refresh();
  };
  const editMemory = (entry: RaDioMemoryEntry) => { setEditingMemory(entry); setMemoryTitle(entry.title); setMemoryValue(entry.value); };
  const forgetMemory = async (memoryId: string) => {
    if (!window.asteria) return;
    await window.asteria.skills.forget({ ...base, idempotencyKey: `forget_${crypto.randomUUID()}`, memoryId });
    refresh();
  };
  const running = useMemo(() => (project.skillExecutions ?? []).filter((item) => item.status === "running" || item.status === "validating"), [project.skillExecutions]);

  return <div className="screen standard-screen skills-screen">
    <header className="section-header"><div><span className="eyebrow">{project.name} · RaDio capability plane</span><h1>Skills</h1><p>Trusted competency modules are selected automatically for each Coordinate and remain constrained by Orbit policy.</p></div><span className="local-badge"><ShieldCheckIcon /> Encrypted & local</span></header>
    <section className="skill-summary">
      <span><SparkleIcon weight="duotone" /><b>{records.filter((item) => item.health === "ready").length}</b><small>Ready skills</small></span>
      <span><CubeIcon weight="duotone" /><b>{records.filter((item) => item.manifest.source === "orbit").length}</b><small>Orbit skills</small></span>
      <span><CheckCircleIcon weight="duotone" /><b>{project.skillExecutions?.length ?? 0}</b><small>Executions</small></span>
      <span><BrainIcon weight="duotone" /><b>{memory.length}</b><small>Memories</small></span>
    </section>
    <div className="skills-layout">
      <section className="settings-panel skills-catalog"><header><div><h2>Competency catalog</h2><p>Built-ins are integrity-verified. Orbit recipes require digest approval.</p></div><button className="toggle-row compact" onClick={() => void saveRadio({ skillsEnabled: !project.radio.skillsEnabled })}><span><strong>Automatic skills</strong><small>Policy chooses the smallest compatible set</small></span><i className={project.radio.skillsEnabled ? "toggle on" : "toggle"}><b /></i></button></header>
        <div className="skill-list">{records.map((record) => <button key={record.manifest.id} className={selected?.manifest.id === record.manifest.id ? "skill-card selected" : "skill-card"} onClick={() => setSelected(record)}>
          <span className={`skill-health ${record.health}`}>{record.health === "ready" ? <CheckCircleIcon weight="fill" /> : <WarningIcon weight="fill" />}</span>
          <span><strong>{record.manifest.name}</strong><small>{record.manifest.description}</small><i>{record.manifest.source === "builtin" ? "Built-in" : "Orbit"} · v{record.manifest.version} · {record.manifest.risk.replace("_", " ")}</i></span>
          <span className={record.enabled ? "skill-state enabled" : "skill-state"}>{record.health}</span>
        </button>)}</div>
      </section>
      <aside className="settings-stack">
        <section className="settings-panel skill-detail"><header><div><h2>{selected?.manifest.name ?? "Select a skill"}</h2><p>{selected ? `${selected.manifest.id} · ${selected.manifest.integrity.slice(0, 12)}` : "Inspect trust, permissions, and compatibility."}</p></div></header>
          {selected && <><div className="skill-tags">{selected.manifest.permissions.map((item) => <span key={item}>{item.replaceAll("_", " ")}</span>)}</div><dl><dt>Coordinates</dt><dd>{selected.manifest.coordinates.join(", ")}</dd><dt>Adapters</dt><dd>{selected.manifest.requiredAdapters.join(", ") || "None"}</dd><dt>Compatibility</dt><dd>{selected.compatibility.compatible ? "Compatible" : selected.compatibility.reasons.join("; ")}</dd><dt>Rollback</dt><dd>{selected.manifest.rollback}</dd></dl><button className={selected.enabled ? "button ghost" : "button primary"} onClick={() => void configure(selected, !selected.enabled)}>{selected.enabled ? "Disable skill" : selected.manifest.source === "orbit" ? "Approve digest & enable" : "Enable skill"}</button></>}
        </section>
        <section className="settings-panel memory-panel"><header><BrainIcon weight="duotone" /><div><h2>Local learning</h2><p>Redacted preferences and outcomes only.</p></div></header>
          <button className="toggle-row compact" onClick={() => void saveRadio({ memoryEnabled: !project.radio.memoryEnabled, ownerMemoryEnabled: project.radio.memoryEnabled ? false : project.radio.ownerMemoryEnabled })}><span><strong>Orbit memory</strong><small>Encrypted and isolated to this project</small></span><i className={project.radio.memoryEnabled ? "toggle on" : "toggle"}><b /></i></button>
          <button className="toggle-row compact" disabled={!project.radio.memoryEnabled} onClick={() => void saveRadio({ ownerMemoryEnabled: !project.radio.ownerMemoryEnabled })}><span><strong>Owner preferences</strong><small>Reuse approved preferences across Orbits</small></span><i className={project.radio.ownerMemoryEnabled ? "toggle on" : "toggle"}><b /></i></button>
          {project.radio.memoryEnabled && <><label className="form-field"><span>{editingMemory ? "Edit memory" : "Remember a convention"}</span><input value={memoryTitle} onChange={(event) => setMemoryTitle(event.target.value)} placeholder="Title" /><textarea value={memoryValue} onChange={(event) => setMemoryValue(event.target.value)} placeholder="Redacted preference or convention" /></label><div className="button-row"><button className="button primary" onClick={() => void saveMemory()}>{editingMemory ? "Save edit" : "Remember"}</button><button className="button secondary" onClick={() => void window.asteria?.skills.exportMemory(project.id)}><ExportIcon /> Export</button></div>{memory.slice(0, 5).map((entry) => <div className="memory-entry" key={entry.id}><button onClick={() => editMemory(entry)}><strong>{entry.title}</strong><small>{entry.value}</small></button><button className="icon-button" aria-label={`Forget ${entry.title}`} onClick={() => void forgetMemory(entry.id)}>×</button></div>)}</>}
        </section>
        {running.length > 0 && <section className="settings-panel"><header><StopCircleIcon /><div><h2>Active skills</h2><p>{running.length} policy-bound execution{running.length === 1 ? "" : "s"}</p></div></header>{running.map((item) => <div className="execution-row" key={item.id}><span><strong>{item.skillId}</strong><small>{item.coordinate} · {item.role}</small></span><button className="button ghost" onClick={() => void cancel(item.id)}>Safe cancel</button></div>)}</section>}
      </aside>
    </div>
  </div>;
}
