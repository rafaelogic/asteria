import { ArrowLeftIcon, GitBranchIcon, LockKeyIcon, RobotIcon, SwapIcon } from "@phosphor-icons/react";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { StarpathStatus } from "../components/StarpathStatus";
import { ProviderSwitch } from "../components/ProviderSwitch";
import { WorkflowRail } from "../components/WorkflowRail";
import type { Project, ProviderId } from "../types";
import { PromptComposer } from "../components/PromptComposer";

export function WorkflowScreen({ project, provider, onProvider, paused, onPause, onApproval, onExecute, onBack }: {
  project: Project;
  provider: ProviderId;
  onProvider: (provider: ProviderId) => void;
  paused: boolean;
  onPause: () => void;
  onApproval: () => void;
  onExecute: () => void;
  onBack: () => void;
}) {
  return (
    <div className="screen workflow-screen">
      <header className="topbar">
        <button className="icon-button" aria-label="Back to projects" onClick={onBack}><ArrowLeftIcon /></button>
        <div className="run-title"><h1>{project.name} Orbit</h1><p><GitBranchIcon /> {project.repository} <LockKeyIcon /> {project.visibility}</p></div>
        <ProviderSwitch value={provider} onChange={onProvider} />
        <div className="run-id"><small>Run ID</small><strong>{project.runId}</strong></div>
      </header>
      <div className="project-objective"><span>Objective</span><p>{project.objective}</p></div>
      <div className="radio-live-rail"><span className="radio-avatar"><RobotIcon weight="duotone" /></span><span><small>RaDio</small><strong>{project.radio.emergencyStopped ? "Emergency stopped" : project.radio.mode === "full_autonomous" ? "Ascendant" : "Guided"}</strong></span><span><small>Coordinate</small><strong>{project.currentAction.milestone}</strong></span><span><small>Relay</small><strong>{project.radio.accountPool.enabled ? "Ready at 5%" : "Configure Relay"}</strong></span>{project.accountTransitions[0] && <span><small>Latest Relay</small><strong><SwapIcon /> {project.accountTransitions[0].fromProvider} → {project.accountTransitions[0].toProvider ?? "blocked"}</strong></span>}</div>
      <PromptComposer projectName={project.name} />
      <div className="workflow-scroll"><WorkflowRail steps={project.workflow} /></div>
      <div className="workflow-body">
        <StarpathStatus paused={paused} onToggle={onPause} onReview={onApproval} onExecute={onExecute} action={project.currentAction} />
        <ActivityTimeline events={project.events} onOpen={onApproval} />
      </div>
      <button className="log-toggle"><span>&gt;_</span> Show live log</button>
    </div>
  );
}
