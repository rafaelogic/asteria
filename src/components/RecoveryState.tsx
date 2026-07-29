import { ArrowClockwiseIcon, CloudSlashIcon, WarningCircleIcon } from "@phosphor-icons/react";

export type RecoveryKind = "loading" | "empty" | "offline" | "stale" | "provider-crash" | "credential-expiry" | "partial-recovery";

const copy: Record<RecoveryKind, { title: string; detail: string }> = {
  loading: { title: "Reconstructing starpath state", detail: "Decrypting local project state and checking isolated sessions." },
  empty: { title: "No projects yet", detail: "Create an isolated project to begin the production workflow." },
  offline: { title: "Working offline", detail: "Local work remains available. GitHub and provider authentication will retry when connectivity returns." },
  stale: { title: "Project changed elsewhere", detail: "Refresh the project before retrying this operation." },
  "provider-crash": { title: "Provider session exited", detail: "The worktree and redacted replay were preserved. Retry or review a provider handoff." },
  "credential-expiry": { title: "Credentials need renewal", detail: "Reconnect inside the Asteria-owned profile. Shared CLI profiles remain untouched." },
  "partial-recovery": { title: "Recovered with pending work", detail: "Asteria restored the last durable Waypoint. Review pending approvals and interrupted tasks." }
};

export function RecoveryState({ kind, onRetry }: { kind: RecoveryKind; onRetry?: () => void }) {
  const value = copy[kind];
  const Icon = kind === "offline" ? CloudSlashIcon : kind === "loading" ? ArrowClockwiseIcon : WarningCircleIcon;
  return <section className={`recovery-state ${kind}`} role="status" aria-live="polite"><Icon weight="duotone" /><h2>{value.title}</h2><p>{value.detail}</p>{onRetry && <button className="button secondary" onClick={onRetry}><ArrowClockwiseIcon /> Retry</button>}</section>;
}
