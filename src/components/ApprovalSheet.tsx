import { GitCommitIcon, ShieldWarningIcon, XIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import type { ApprovalRequest } from "../types";
import { ShinyText } from "./MotionBits";

export function ApprovalSheet({ open, request, onClose, onApprove, onDeny }: {
  open: boolean;
  request?: ApprovalRequest;
  onClose: () => void;
  onApprove: () => void;
  onDeny: () => void;
}) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <motion.section className="approval-sheet electric-border approval-electric" role="dialog" aria-modal="true" aria-labelledby="approval-title" onMouseDown={(event) => event.stopPropagation()} initial={{ y: 50, opacity: 0, filter: "blur(6px)" }} animate={{ y: 0, opacity: 1, filter: "blur(0px)" }} transition={{ duration: .34, ease: [.22, 1, .36, 1] }}>
        <button className="icon-button sheet-close" onClick={onClose} aria-label="Close approval"><XIcon /></button>
        <div className="sheet-title">
          <span className="sheet-shield"><ShieldWarningIcon weight="duotone" /></span>
          <div><span className="eyebrow violet"><ShinyText>Approval required</ShinyText></span><h2 id="approval-title">{request?.title ?? "Review project mutation"}</h2></div>
        </div>
        <p className="sheet-lede">{request?.detail ?? "Review the requested action before the workflow continues."}</p>
        <span className="risk-pill">{(request?.risk ?? "workspace_write").replace("_", " ")} risk</span>
        <div className="approval-grid">
          <span><small>Operation</small><strong><GitCommitIcon /> {request?.title ?? "Workspace change"}</strong></span>
          <span><small>Specialist</small><strong>{request?.specialist ?? "Developer Pool"}</strong></span>
          <span><small>Run</small><strong>{request?.runId ?? "Current starpath"}</strong></span>
          <span><small>Files affected</small><strong>{request?.files.length ?? 0} declared paths</strong></span>
        </div>
        <div className="files">
          {(request?.files ?? ["No file manifest supplied"]).slice(0, 3).map((file) => <span key={file}><strong>{file}</strong><b>declared</b></span>)}
        </div>
        <div className="sheet-actions">
          <button className="button primary purple" onClick={onApprove}>Approve</button>
          <button className="button secondary" onClick={onDeny}>Deny</button>
        </div>
      </motion.section>
    </div>
  );
}
