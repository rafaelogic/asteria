import { useEffect, useState } from "react";
import { CheckCircleIcon, DatabaseIcon, GlobeHemisphereWestIcon, ProhibitIcon, ShieldCheckIcon, TrashIcon } from "@phosphor-icons/react";
import type { NetworkApproval, NetworkRequest } from "../types";
import type { DialogModel } from "../components/AppDialog";

export function PrivacyScreen({ auditCount, onDialog }: { auditCount: number; onDialog: (dialog: DialogModel | null) => void }) {
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [approvals, setApprovals] = useState<NetworkApproval[]>([]);
  const [cleared, setCleared] = useState(false);
  useEffect(() => {
    if (!window.asteria) return;
    void Promise.all([window.asteria.networkPolicy.requests(), window.asteria.networkPolicy.approvals()])
      .then(([nextRequests, nextApprovals]) => { setRequests(nextRequests); setApprovals(nextApprovals); })
      .catch(() => undefined);
  }, []);
  const remove = async () => {
    await window.asteria?.telemetry.clear();
    setRequests([]); setCleared(true);
  };
  return <div className="screen standard-screen narrow-screen">
    <header className="section-header"><div><span className="eyebrow">Privacy & network</span><h1>Local by construction</h1><p>Asteria strips upstream telemetry and isolates every provider session.</p></div><span className="health-score"><ShieldCheckIcon weight="duotone" /> Protected</span></header>
    <div className="privacy-summary"><section><DatabaseIcon weight="duotone" /><span><strong>Encrypted local storage</strong><small>Transcripts and boards remain on-device.</small></span><CheckCircleIcon className="success" weight="fill" /></section><section><ProhibitIcon weight="duotone" /><span><strong>Creator telemetry denied</strong><small>Supabase, community-pulse, analytics and install IDs removed.</small></span><CheckCircleIcon className="success" weight="fill" /></section><section><GlobeHemisphereWestIcon weight="duotone" /><span><strong>Outbound requests controlled</strong><small>Provider, GitHub and explicit user destinations only.</small></span><b>{requests.filter((request) => request.decision !== "allow").length || auditCount} denied</b></section></div>
    <div className="network-table"><header><h2>Recent network decisions</h2><button className="text-button" onClick={() => void window.asteria?.telemetry.export()}>Export audit</button></header>
      {requests.length ? requests.map((request) => <div className="network-row" key={request.id}><span className={`decision ${request.decision === "allow" ? "allow" : "deny"}`}>{request.decision === "review" ? "Review" : request.decision === "allow" ? "Allowed" : "Denied"}</span><strong>{request.host}</strong><small>{request.process} · {request.reason}</small><time>{new Date(request.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{request.decision === "review" && <button className="text-button" onClick={() => void window.asteria?.networkPolicy.decide({ requestId: request.id, decision: "allow", scope: "once" }).then((approval) => setApprovals((current) => [approval, ...current]))}>Allow once</button>}</div>) : <>
        <div className="network-row"><span className="decision allow">Allowed</span><strong>api.github.com</strong><small>GitHub · device flow</small><time>Local</time></div><div className="network-row"><span className="decision deny">Denied</span><strong>telemetry.asteria.invalid</strong><small>Unapproved analytics endpoint</small><time>Policy</time></div>
      </>}
    </div>
    {approvals.length > 0 && <div className="network-table"><header><h2>Active destination approvals</h2><span>{approvals.length} active</span></header>{approvals.map((approval) => <div className="network-row" key={approval.id}><span className={`decision ${approval.decision}`}>{approval.decision}</span><strong>{approval.host}</strong><small>{approval.scope} scope</small><button className="text-button" onClick={() => void window.asteria?.networkPolicy.revoke(approval.id).then(() => setApprovals((current) => current.filter((item) => item.id !== approval.id)))}>Revoke</button></div>)}</div>}
    <button className="danger-button" onClick={() => onDialog({ title: "Delete all local telemetry?", detail: "This securely removes unpinned metrics and replay data from this Asteria profile. This cannot be undone.", tone: "danger", confirmLabel: "Delete telemetry", cancelLabel: "Keep data", onConfirm: () => void remove() })}><TrashIcon /> {cleared ? "Local telemetry deleted" : "Delete all local telemetry"}</button>
  </div>;
}
