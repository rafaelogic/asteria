import { useState } from "react";
import { GitBranchIcon, LinkIcon, PlusIcon, ShieldCheckIcon, UserCircleIcon, XIcon } from "@phosphor-icons/react";
import type { BoardColumn, Project, ProviderId } from "../types";
import { AnimatedListItem, spotlightPointer } from "../components/MotionBits";

const columns: BoardColumn[] = ["Backlog", "Ready", "Running", "Review", "Blocked", "Done"];

export function KanbanScreen({ project, onProject }: { project: Project; onProject: (project: Project) => void }) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState<ProviderId>(project.provider);
  const mutate = { projectId: project.id, runId: project.runId, expectedVersion: project.version };
  const add = async () => {
    if (!title.trim()) return;
    if (window.asteria) {
      onProject(await window.asteria.boards.add({ ...mutate, idempotencyKey: `task_${crypto.randomUUID()}`, card: { title, column: "Backlog", provider, meta: "Manual · ready", role: "planner", risk: "workspace_write", attempt: 1 } }));
    } else {
      onProject({ ...project, version: project.version + 1, tasks: [...project.tasks, { id: crypto.randomUUID(), projectId: project.id, title, column: "Backlog", provider, meta: "Manual · ready", role: "planner", risk: "workspace_write", attempt: 1 }] });
    }
    setTitle(""); setCreating(false);
  };
  const move = async (taskId: string, column: BoardColumn) => {
    if (window.asteria) onProject(await window.asteria.boards.move({ ...mutate, idempotencyKey: `move_${crypto.randomUUID()}`, taskId, column }));
    else onProject({ ...project, version: project.version + 1, tasks: project.tasks.map((task) => task.id === taskId ? { ...task, column } : task) });
  };
  return <div className="screen standard-screen">
    <header className="section-header"><div><span className="eyebrow">{project.name} · Orbit execution</span><h1>Star Map</h1><p>Tickets belong to this Orbit’s Starpath and evidence trail.</p></div><button className="button primary" onClick={() => setCreating(true)}><PlusIcon /> New ticket</button></header>
    <div className="kanban-board">{columns.map((column) => <section className="kanban-column" key={column} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void move(event.dataTransfer.getData("text/task-id"), column)}>
      <header><h2>{column}</h2><span>{project.tasks.filter((task) => task.column === column).length}</span></header>
      {project.tasks.filter((task) => task.column === column).map((task, index) => <AnimatedListItem index={index} key={task.id}><button className="task-card spotlight-surface" onPointerMove={spotlightPointer} draggable onDragStart={(event) => event.dataTransfer.setData("text/task-id", task.id)}>
        <span className="task-owner"><UserCircleIcon weight="duotone" /><b>{project.workflow.find((step) => step.role === task.role)?.specialist ?? "Project Planner"}</b><i className={`provider-dot ${task.provider}`} /></span>
        <strong>{task.title}</strong><small>{task.meta}{task.attempt ? ` · attempt ${task.attempt}` : ""}</small>
        <span className="task-facts"><em><ShieldCheckIcon /> {task.risk?.replace("_", " ") ?? "read"}</em><em><GitBranchIcon /> {task.requirementIds?.length ?? 1} req</em>{Boolean(task.dependencies?.length) && <em><LinkIcon /> {task.dependencies!.length}</em>}</span>
      </button></AnimatedListItem>)}
      <button className="add-card" onClick={() => setCreating(true)}><PlusIcon /> Add task</button>
    </section>)}</div>
    {creating && <div className="modal-backdrop" onMouseDown={() => setCreating(false)}><section className="mini-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Project task</span><h2>Create task</h2></div><button className="icon-button" onClick={() => setCreating(false)}><XIcon /></button></header><label className="form-field"><span>Task title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void add(); }} /></label><label className="form-field"><span>Provider</span><select value={provider} onChange={(event) => setProvider(event.target.value as ProviderId)}><option value="codex">OpenAI Codex</option><option value="claude">Claude Code</option></select></label><footer><button className="button secondary" onClick={() => setCreating(false)}>Cancel</button><button className="button primary" onClick={() => void add()}>Create task</button></footer></section></div>}
  </div>;
}
