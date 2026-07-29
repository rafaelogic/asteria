import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightIcon, CheckCircleIcon, ChatCircleDotsIcon, LightbulbIcon, MagnifyingGlassIcon, RobotIcon, ShieldCheckIcon, SparkleIcon, UserCircleIcon, XIcon } from "@phosphor-icons/react";
import type { IdeaProposal, IdeaStatus, Project } from "../types";
import { RaDioCorePreview } from "./radio-preview";

const filters: Array<{ value: "all" | IdeaStatus; label: string }> = [
  { value: "all", label: "All" }, { value: "new", label: "New" }, { value: "saved", label: "Saved" },
  { value: "selected", label: "Selected" }, { value: "dismissed", label: "Dismissed" }, { value: "promoted", label: "Promoted" }
];

export function IdeasScreen({ project, onProject }: { project: Project; onProject: (project: Project) => void }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const [selected, setSelected] = useState<IdeaProposal | null>(null);
  const [scouting, setScouting] = useState(false);
  const visible = useMemo(() => project.ideas.filter((idea) => filter === "all" || idea.status === filter), [filter, project.ideas]);
  const mutation = { projectId: project.id, runId: project.runId, expectedVersion: project.version };
  const scout = async () => {
    setScouting(true);
    try {
      if (window.asteria) onProject(await window.asteria.radio.scout({ ...mutation, idempotencyKey: `radio_scout_${crypto.randomUUID()}` }));
      else onProject({ ...project, version: project.version + 1, ideas: RaDioCorePreview.scout(project) });
    } finally { setScouting(false); }
  };
  const update = async (ideaId: string, status: IdeaStatus) => {
    if (window.asteria) onProject(await window.asteria.radio.updateIdea({ ...mutation, idempotencyKey: `radio_idea_${crypto.randomUUID()}`, ideaId, status }));
    else onProject({ ...project, version: project.version + 1, ideas: project.ideas.map((idea) => idea.id === ideaId ? { ...idea, status } : idea) });
    setSelected(null);
  };
  return <div className="screen standard-screen ideas-screen">
    <header className="section-header"><div><span className="eyebrow">{project.name} · RaDio intelligence</span><h1>Signals</h1><p>Evidence-backed opportunities stay separate from execution until RaDio or a human promotes them.</p></div><button className="button primary" disabled={scouting || project.radio.emergencyStopped} onClick={() => void scout()}><SparkleIcon weight="fill" /> {scouting ? "Scanning…" : "Scan for signals"}</button></header>
    <div className="radio-status-strip"><span className="radio-avatar"><RobotIcon weight="duotone" /></span><span><small>RaDio mode</small><strong>{project.radio.mode === "full_autonomous" ? "Ascendant" : "Guided"}</strong></span><span><small>Authority</small><strong>{project.radio.mergeProductionEnabled ? "Staging + verified production" : project.radio.mode === "full_autonomous" ? "Staging only" : "External actions gated"}</strong></span><span><small>Relay</small><strong>{project.radio.accountPool.enabled ? "5% threshold · cross-provider" : "Not configured"}</strong></span><b className={project.radio.emergencyStopped ? "blocked" : ""}>{project.radio.emergencyStopped ? "Stopped" : "Active"}</b></div>
    <div className="idea-toolbar"><div>{filters.map((item) => <button key={item.value} className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)}>{item.label}<span>{item.value === "all" ? project.ideas.length : project.ideas.filter((idea) => idea.status === item.value).length}</span></button>)}</div><label><MagnifyingGlassIcon /> Ranked by value and confidence</label></div>
    {visible.length ? <div className="ideas-grid">{visible.map((idea, index) => <motion.button layout key={idea.id} className="idea-card spotlight-surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }} onClick={() => setSelected(idea)}>
      <header><span className={`idea-impact ${idea.impact}`}>{idea.impact} impact</span><b>{Math.round(idea.confidence * 100)}% confidence</b></header><h2>{idea.title}</h2><p>{idea.opportunity}</p><span className="idea-persona"><UserCircleIcon /> {idea.persona}</span><footer><span>{idea.panelRoles.slice(0, 3).map((role) => role.replace("_", " ")).join(" · ")}</span><ArrowRightIcon /></footer>
    </motion.button>)}</div> : <section className="ideas-empty"><LightbulbIcon weight="duotone" /><h2>{project.ideas.length ? "No signals in this view" : "RaDio is ready to look for value"}</h2><p>Scan the Orbit objective and evidence, then convene a Constellation around the strongest opportunities.</p><button className="button secondary" onClick={() => void scout()}><SparkleIcon /> Scan this Orbit</button></section>}
    <AnimatePresence>{selected && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setSelected(null)}><motion.section className="idea-detail-modal" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="eyebrow">RaDio proposal · {selected.status}</span><h2>{selected.title}</h2></div><button className="icon-button" onClick={() => setSelected(null)}><XIcon /></button></header>
      <div className="idea-detail-body"><section><small>Problem</small><p>{selected.problem}</p><small>Opportunity</small><p>{selected.opportunity}</p><small>RaDio recommendation</small><p>{selected.recommendation}</p></section><aside><small>Constellation</small>{selected.panelRoles.map((role) => <span key={role}><UserCircleIcon /><b>{role.replace("_", " ")}</b><CheckCircleIcon weight="fill" /></span>)}<small>Evidence</small>{selected.evidence.map((evidence) => <span key={evidence.id}><ShieldCheckIcon /><b>{evidence.title}</b></span>)}</aside></div>
      <footer><button className="button ghost" onClick={() => void update(selected.id, "dismissed")}>Dismiss</button><button className="button secondary" onClick={() => void update(selected.id, "saved")}><ChatCircleDotsIcon /> Save & discuss</button><button className="button primary" onClick={() => void update(selected.id, project.radio.mode === "full_autonomous" ? "running" : "selected")}><RobotIcon /> {project.radio.mode === "full_autonomous" ? "Let RaDio run" : "Select idea"}</button></footer>
    </motion.section></motion.div>}</AnimatePresence>
  </div>;
}
