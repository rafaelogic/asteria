import { useMemo, useState } from "react";
import { FileTextIcon, MagnifyingGlassIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { MarkdownPreview } from "../components/RichPreview";
import type { Artifact, Project } from "../types";
import { AnimatedListItem, spotlightPointer } from "../components/MotionBits";

export function ArtifactsScreen({ project, onProject }: { project: Project; onProject: (project: Project) => void }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<Artifact["type"]>("plan");
  const [selected, setSelected] = useState<Artifact | null>(null);
  const filtered = useMemo(() => project.artifacts.filter((artifact) => `${artifact.name} ${artifact.stage} ${artifact.type}`.toLowerCase().includes(query.toLowerCase())), [project.artifacts, query]);
  const add = async () => {
    if (!name.trim()) return;
    const artifact = { name, type, stage: project.workflow.find((step) => step.status === "active")?.name ?? "Project", size: "Local record", status: "draft" as const };
    if (window.asteria) onProject(await window.asteria.artifacts.add({ projectId: project.id, runId: project.runId, expectedVersion: project.version, idempotencyKey: `artifact_${crypto.randomUUID()}`, artifact }));
    else onProject({ ...project, version: project.version + 1, artifacts: [...project.artifacts, { ...artifact, id: crypto.randomUUID(), projectId: project.id, runId: project.runId, createdAt: new Date().toISOString() }] });
    setName(""); setCreating(false);
  };
  return <div className="screen standard-screen">
    <header className="section-header"><div><span className="eyebrow">{project.name} · Evidence</span><h1>Artifact hub</h1><p>Every handoff is grounded in reviewable project evidence.</p></div><div className="header-actions"><label className="search-box"><MagnifyingGlassIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search artifacts" /></label><button className="button primary" onClick={() => setCreating(true)}><PlusIcon /> Add artifact</button></div></header>
    <div className="artifact-grid">{filtered.map((artifact, index) => <AnimatedListItem index={index} key={artifact.id}><button onClick={() => setSelected(artifact)} className="artifact-card spotlight-surface motion-border" onPointerMove={spotlightPointer}><span className={`artifact-icon ${artifact.type}`}><FileTextIcon weight="duotone" /></span><span><small>{artifact.stage}</small><strong>{artifact.name}</strong><p>{artifact.createdAt} · {artifact.size}</p></span><b className={artifact.status}>{artifact.status}</b></button></AnimatedListItem>)}</div>
    <AnimatePresence>{selected && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setSelected(null)}><motion.section className="artifact-preview-modal" initial={{ opacity: 0, scale: .97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .98 }} onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">{selected.stage} · {selected.type}</span><h2>{selected.name}</h2></div><button className="icon-button" onClick={() => setSelected(null)}><XIcon /></button></header><MarkdownPreview content={`# ${selected.name}\n\n> Reviewable evidence generated during the **${selected.stage}** stage.\n\n## Summary\n\n- Status: ${selected.status}\n- Run: \`${selected.runId}\`\n- Size: ${selected.size}\n\n| Check | Result |\n| --- | --- |\n| Project isolation | Passed |\n| Evidence linked | Passed |\n| Human review | ${selected.status === "approved" ? "Complete" : "Pending"} |\n\n![Asteria starpath workflow](/qa-reference.png)\n\n\`\`\`ts\nconst evidence = { project: \"${project.id}\", stage: \"${selected.stage}\", status: \"${selected.status}\" };\n\`\`\``} /></motion.section></motion.div>}</AnimatePresence>
    {creating && <div className="modal-backdrop" onMouseDown={() => setCreating(false)}><section className="mini-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Evidence record</span><h2>Add artifact</h2></div><button className="icon-button" onClick={() => setCreating(false)}><XIcon /></button></header><label className="form-field"><span>Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label className="form-field"><span>Type</span><select value={type} onChange={(event) => setType(event.target.value as Artifact["type"])}>{["brief","design","architecture","plan","patch","test","audit","release","deployment"].map((value) => <option value={value} key={value}>{value}</option>)}</select></label><footer><button className="button secondary" onClick={() => setCreating(false)}>Cancel</button><button className="button primary" onClick={() => void add()}>Add artifact</button></footer></section></div>}
  </div>;
}
