import { useMemo, useState } from "react";
import { ArrowUpIcon, ArrowsOutIcon, RobotIcon, XIcon } from "@phosphor-icons/react";
import type { Project } from "../types";

export function FloatingRaDio({ project, onProject, onMaximize }: {
  project: Project;
  onProject: (project: Project) => void;
  onMaximize: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messages = useMemo(() => project.radioChats.find((chat) => chat.runId === project.runId)?.messages.slice(-3) ?? [], [project.radioChats, project.runId]);
  const send = async () => {
    if (!body.trim() || !window.asteria) return;
    setBusy(true);
    setError("");
    try {
      const updated = await window.asteria.radioChat.send({
        projectId: project.id,
        runId: project.runId,
        expectedVersion: project.version,
        idempotencyKey: `floating_radio_${crypto.randomUUID()}`,
        body,
        references: [],
        attachmentIds: [],
      });
      onProject(updated);
      setBody("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "RaDio could not send this message.");
    } finally { setBusy(false); }
  };
  return <div className={`floating-radio ${open ? "open" : "minimized"}`}>
    {open && <section className="floating-radio-panel" aria-label="RaDio quick chat">
      <header><span className="radio-avatar"><RobotIcon weight="duotone" /></span><span><strong>RaDio</strong><small>{project.name} · {project.takeover.health}</small></span><button aria-label="Open full RaDio screen" onClick={onMaximize}><ArrowsOutIcon /></button><button aria-label="Minimize RaDio" onClick={() => setOpen(false)}><XIcon /></button></header>
      <div className="floating-radio-messages">{messages.length ? messages.map((message) => <div key={message.id} className={message.author}><strong>{message.author === "radio" ? "RaDio" : "You"}</strong><p>{message.body || (message.status === "streaming" ? "Coordinating…" : "Command recorded")}</p></div>) : <div className="empty"><RobotIcon /><p>Ask about this Orbit or direct its current work.</p></div>}</div>
      {error && <p className="radio-send-error" role="alert">{error}</p>}
      <footer><textarea aria-label="Quick message to RaDio" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Message RaDio…" onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void send(); }} /><button aria-label="Send quick message" disabled={busy || !body.trim()} onClick={() => void send()}><ArrowUpIcon weight="bold" /></button></footer>
    </section>}
    {!open && <button className="floating-radio-button" aria-label="Open RaDio quick chat" onClick={() => setOpen(true)}><RobotIcon weight="duotone" /><span>RaDio</span><i className={project.takeover.health} /></button>}
  </div>;
}
