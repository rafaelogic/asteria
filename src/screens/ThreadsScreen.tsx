import { useState } from "react";
import { ArrowUpIcon, AtIcon, CheckCircleIcon, PaperclipIcon, QuestionIcon } from "@phosphor-icons/react";
import type { Project } from "../types";

export function ThreadsScreen({ project, onProject }: { project: Project; onProject: (project: Project) => void }) {
  const [body, setBody] = useState("");
  const post = async () => {
    if (!body.trim()) return;
    const mutation = { projectId: project.id, runId: project.runId, expectedVersion: project.version, idempotencyKey: `message_${crypto.randomUUID()}` };
    const message = { author: "Human", role: "Project owner", body, tone: "cyan" as const, threadId: "human-direction" };
    if (window.asteria) onProject(await window.asteria.threads.post({ ...mutation, message }));
    else onProject({ ...project, version: project.version + 1, messages: [...project.messages, { ...message, id: crypto.randomUUID(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }] });
    setBody("");
  };
  const promote = async (messageId: string) => {
    if (!window.asteria) return;
    onProject(await window.asteria.threads.promote({ projectId: project.id, runId: project.runId, expectedVersion: project.version, idempotencyKey: `promote_${crypto.randomUUID()}`, messageId }));
  };
  return <div className="screen standard-screen narrow-screen">
    <header className="section-header"><div><span className="eyebrow">{project.name} · Agent discussion</span><h1>Starpath handoffs</h1><p>Specialists resolve decisions and defects inside this project.</p></div><span className="local-badge">Local only</span></header>
    <div className="thread-list">{project.messages.map((message) => <article className="message" key={message.id}><span className={`message-avatar ${message.tone}`}>{message.author.slice(0, 1)}</span><div><header><strong>{message.author}</strong><span>{message.role}</span>{message.decision ? <b className="thread-state decision"><CheckCircleIcon /> Decision</b> : null}{message.unresolved ? <b className="thread-state unresolved"><QuestionIcon /> Unresolved</b> : null}<time>{message.time}</time></header><p>{message.body}</p>{message.unresolved ? <button className="message-action" onClick={() => void promote(message.id)}>Promote to task</button> : null}</div></article>)}</div>
    <div className="composer"><textarea aria-label="Message agents" value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void post(); }} placeholder="Direct the agents…" /><footer><span><button aria-label="Attach"><PaperclipIcon /></button><button aria-label="Mention"><AtIcon /></button></span><button className="send-button" aria-label="Send" onClick={() => void post()}><ArrowUpIcon weight="bold" /></button></footer></div>
  </div>;
}
