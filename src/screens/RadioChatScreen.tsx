import { useEffect, useMemo, useState } from "react";
import { ArrowUpIcon, BrainIcon, CheckCircleIcon, FileIcon, PaperclipIcon, PauseIcon, PulseIcon, RobotIcon, StopCircleIcon, WarningIcon, WrenchIcon, XIcon } from "@phosphor-icons/react";
import { MarkdownPreview } from "../components/RichPreview";
import type { Project, RaDioChatAttachment, UserInstallState } from "../types";
import { useRadioReadiness } from "../hooks/useRadioReadiness";
import { ResponseActivity } from "../components/ResponseActivity";

const suggestions = ["What is the current health of this Orbit?", "Activate the right Star for open incidents", "Run the relevant checks", "Explain the latest Waypoint"];

export function RadioChatScreen({ project, onProject }: { project: Project; onProject: (project: Project) => void }) {
  const chats = project.radioChats ?? [];
  const active = chats.find((chat) => chat.runId === project.runId) ?? chats.at(-1);
  const [selectedChatId, setSelectedChatId] = useState(active?.id ?? "");
  const selected = chats.find((chat) => chat.id === selectedChatId) ?? active;
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<RaDioChatAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const [install, setInstall] = useState<UserInstallState>({ rollbackReady: false });
  const readiness = useRadioReadiness(project.provider, project);
  const base = { projectId: project.id, runId: project.runId, expectedVersion: project.version };
  const openIncidents = useMemo(() => project.incidents.filter((item) => item.status !== "resolved"), [project.incidents]);
  useEffect(() => { void window.asteria?.installer.state().then(setInstall); }, [project.id]);

  const attach = async () => {
    const selectedFiles = await window.asteria?.radioChat.selectAttachments(project.id);
    if (selectedFiles) setAttachments((current) => [...current, ...selectedFiles].slice(0, 20));
  };
  const send = async (value = body) => {
    if (!value.trim() || !window.asteria || selected?.archived || !readiness.ready) return;
    setBusy(true);
    setSendError("");
    try {
      const updated = await window.asteria.radioChat.send({ ...base, idempotencyKey: `radio_chat_${crypto.randomUUID()}`, body: value, references: [], attachmentIds: attachments.filter((item) => item.status === "ready").map((item) => item.id) });
      onProject(updated); setBody(""); setAttachments([]);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "RaDio could not send this message.");
    } finally { setBusy(false); }
  };
  const takeover = async (action: "pause" | "resume" | "scan") => {
    if (window.asteria) onProject(await window.asteria.radio.takeoverControl({ ...base, idempotencyKey: `takeover_${crypto.randomUUID()}`, action }));
  };
  const cancel = async (messageId: string) => {
    if (window.asteria) onProject(await window.asteria.radioChat.cancel({ ...base, idempotencyKey: `chat_cancel_${crypto.randomUUID()}`, messageId }));
  };
  const reinstall = async () => { if (window.asteria) { setBusy(true); await window.asteria.installer.prepare({ ...base, idempotencyKey: `install_${crypto.randomUUID()}` }); } };
  const rollback = async () => { if (window.asteria) await window.asteria.installer.rollback({ ...base, idempotencyKey: `rollback_${crypto.randomUUID()}` }); };

  return <div className="screen radio-chat-screen">
    <header className="radio-chat-header">
      <div><span className="eyebrow">{project.name} · Run {project.runId}</span><h1><span className="radio-avatar"><RobotIcon weight="duotone" /></span> Chat with RaDio</h1><p>Ask, direct, inspect, or activate Stars. Every command remains inside the Orbit policy.</p></div>
      <div className="radio-chat-actions"><button className="button secondary" onClick={() => void takeover("scan")}><PulseIcon /> Health scan</button><button className="button secondary" onClick={() => void takeover(project.takeover.phase === "paused" ? "resume" : "pause")}>{project.takeover.phase === "paused" ? <RobotIcon /> : <PauseIcon />} {project.takeover.phase === "paused" ? "Resume" : "Pause"}</button><button className="button secondary" disabled={busy || project.radio.mode !== "full_autonomous"} onClick={() => void reinstall()}><WrenchIcon /> Build & reinstall</button>{install.rollbackReady && <button className="button secondary" onClick={() => void rollback()}>Rollback</button>}</div>
    </header>
    <div className="radio-chat-status">
      <span><small>Takeover</small><strong>{project.takeover.enabled ? project.takeover.phase : "Off"}</strong></span>
      <span><small>Health</small><strong className={project.takeover.health === "healthy" ? "success" : "warning"}>{project.takeover.health}</strong></span>
      <span><small>Coordinate</small><strong>{project.takeover.currentCoordinate ?? project.currentAction.milestone}</strong></span>
      <span><small>Incidents</small><strong>{openIncidents.length}</strong></span>
      <span><small>Staging</small><strong>{project.takeover.staging?.status ?? "Waiting"}</strong></span>
    </div>
    <div className="radio-chat-layout">
      <aside className="radio-chat-runs"><span className="eyebrow">Run conversations</span>{chats.map((chat) => <button key={chat.id} className={selected?.id === chat.id ? "active" : ""} onClick={() => setSelectedChatId(chat.id)}><span><strong>{chat.runId}</strong><small>{chat.archived ? "Archived · read only" : "Active run"}</small></span><b>{chat.messages.length}</b></button>)}
        {openIncidents.length > 0 && <section><span className="eyebrow">Open incidents</span>{openIncidents.slice(0, 4).map((incident) => <div key={incident.id}><WarningIcon /><span><strong>{incident.title}</strong><small>{incident.owner} · {incident.status}</small></span></div>)}</section>}
      </aside>
      <section className="radio-conversation">
        <div className="radio-messages">{selected?.messages.length ? selected.messages.map((message) => <article key={message.id} className={`radio-message ${message.author}`}>
          <span className="radio-message-avatar">{message.author === "radio" ? <RobotIcon weight="duotone" /> : "You"}</span>
          <div><header><strong>{message.author === "radio" ? "RaDio" : "Project owner"}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{message.status === "streaming" && <i className="streaming-dot" />}</header>
            {message.body && <MarkdownPreview content={message.body} />}
            {message.status === "streaming" && <ResponseActivity hasContent={Boolean(message.body)} />}
            {message.attachments.length > 0 && <div className="chat-attachments sent">{message.attachments.map((attachment) => <span key={attachment.id}><FileIcon /><b>{attachment.name}</b><small>{Math.ceil(attachment.size / 1024)} KB</small></span>)}</div>}
            {message.command && <div className={`chat-command ${message.command.status}`}><BrainIcon /><span><strong>{message.command.kind} command</strong><small>{message.command.policyReason}</small></span><b>{message.command.status}</b></div>}
            {message.cards.map((card) => <div className={`chat-execution-card ${card.status}`} key={card.id}>{card.status === "completed" ? <CheckCircleIcon /> : card.status === "failed" || card.status === "blocked" ? <WarningIcon /> : <PulseIcon />}<span><strong>{card.title}</strong><small>{card.detail}</small></span><b>{card.status}</b></div>)}
            {message.status === "streaming" && <button className="text-button" onClick={() => void cancel(message.id)}><StopCircleIcon /> Stop response</button>}
          </div>
        </article>) : <div className="radio-chat-empty"><RobotIcon weight="duotone" /><h2>RaDio is listening</h2><p>Ask about this Orbit or give RaDio a command. Safety policy is applied before every action.</p><div>{suggestions.map((item) => <button key={item} onClick={() => void send(item)}>{item}</button>)}</div></div>}</div>
        {!selected?.archived && <div className="radio-chat-composer">
          {!readiness.ready && <div className="radio-readiness"><strong>{readiness.loading ? "Checking RaDio prerequisites…" : "RaDio is not ready yet"}</strong>{readiness.checks.map((check) => <p className={check.ready ? "ready" : ""} key={check.label}><b>{check.ready ? "Ready" : "Required"}</b><span>{check.label}<small>{check.detail}</small></span></p>)}<button className="button secondary" onClick={() => void readiness.refresh()}>Check again</button></div>}
          {sendError && <p className="radio-send-error" role="alert">{sendError}</p>}
          {attachments.length > 0 && <div className="chat-attachments">{attachments.map((attachment) => <span key={attachment.id} className={attachment.status}><FileIcon /><b>{attachment.name}</b><small>{attachment.status}</small><button aria-label={`Remove ${attachment.name}`} onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}><XIcon /></button></span>)}</div>}
          <textarea aria-label="Message RaDio" disabled={!readiness.ready} value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) { event.preventDefault(); void send(); } }} placeholder={readiness.ready ? "Ask RaDio or direct the Orbit…" : "Complete RaDio setup before chatting"} />
          <footer><button className="icon-button" aria-label="Attach files" disabled={!readiness.ready} onClick={() => void attach()}><PaperclipIcon /></button><span>Enter to send · Ctrl/⌘ + Enter for a new line</span><button className="send-button" aria-label="Send to RaDio" disabled={busy || !body.trim() || !readiness.ready} onClick={() => void send()}><ArrowUpIcon weight="bold" /></button></footer>
        </div>}
      </section>
    </div>
  </div>;
}
