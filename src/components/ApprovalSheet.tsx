import { GitCommitIcon, ShieldWarningIcon, XIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import type { ApprovalRequest, AuthorizationRequest, AuthorizationScope } from "../types";
import { ShinyText } from "./MotionBits";

export function ApprovalSheet({ open, request, authorization, onClose, onApprove, onAuthorize, onDeny }: {
  open: boolean;
  request?: ApprovalRequest;
  authorization?: AuthorizationRequest;
  onClose: () => void;
  onApprove: () => void;
  onAuthorize?: (scope: AuthorizationScope) => void;
  onDeny: () => void;
}) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <motion.section className="approval-sheet electric-border approval-electric" role="dialog" aria-modal="true" aria-labelledby="approval-title" onMouseDown={(event) => event.stopPropagation()} initial={{ y: 50, opacity: 0, filter: "blur(6px)" }} animate={{ y: 0, opacity: 1, filter: "blur(0px)" }} transition={{ duration: .34, ease: [.22, 1, .36, 1] }}>
        <button className="icon-button sheet-close" onClick={onClose} aria-label="Close approval"><XIcon /></button>
        <div className="sheet-title">
          <span className="sheet-shield"><ShieldWarningIcon weight="duotone" /></span>
          <div><span className="eyebrow violet"><ShinyText>{authorization?.kind === "authentication" ? "Sign-in required" : "Authorization required"}</ShinyText></span><h2 id="approval-title">{authorization?.operation ?? request?.title ?? "Review project mutation"}</h2></div>
        </div>
        <p className="sheet-lede">{authorization?.reason ?? request?.detail ?? "Review the requested action before the workflow continues."}</p>
        <span className="risk-pill">{(authorization?.risk ?? request?.risk ?? "workspace_write").replace("_", " ")} risk</span>
        <div className="approval-grid">
          <span><small>Operation</small><strong><GitCommitIcon /> {authorization?.operation ?? request?.title ?? "Workspace change"}</strong></span>
          <span><small>Specialist</small><strong>{authorization?.role ?? request?.specialist ?? "Developer Pool"}</strong></span>
          <span><small>Run</small><strong>{authorization?.runId ?? request?.runId ?? "Current starpath"}</strong></span>
          <span><small>Files affected</small><strong>{request?.files.length ?? 0} declared paths</strong></span>
        </div>
        <div className="files">
          {(authorization ? [authorization.resource] : request?.files ?? ["No file manifest supplied"]).slice(0, 3).map((file) => <span key={file}><strong>{file}</strong><b>{authorization?.permission ?? "declared"}</b></span>)}
        </div>
        <div className="sheet-actions">
          {authorization ? authorization.kind === "authentication"
            ? <button className="button primary purple" onClick={() => onAuthorize?.("once")}>Sign in</button>
            : <>
              {authorization.eligibleScopes.includes("once") && <button className="button primary purple" onClick={() => onAuthorize?.("once")}>Allow once</button>}
              {authorization.eligibleScopes.includes("session") && <button className="button secondary" onClick={() => onAuthorize?.("session")}>Allow for session</button>}
              {authorization.eligibleScopes.includes("orbit") && <button className="button secondary" onClick={() => onAuthorize?.("orbit")}>Always for this Orbit</button>}
            </>
            : <button className="button primary purple" onClick={onApprove}>Approve</button>}
          <button className="button secondary" onClick={onDeny}>Deny</button>
        </div>
      </motion.section>
    </div>
  );
}
