import { PauseIcon, PlayIcon, TerminalWindowIcon } from "@phosphor-icons/react";
import type { StarpathAction } from "../types";
import { AgenticOrbit, ShinyText, spotlightPointer } from "./MotionBits";

export function StarpathStatus({ paused, onToggle, onReview, onExecute, action }: { paused: boolean; onToggle: () => void; onReview: () => void; onExecute: () => void; action: StarpathAction }) {
  return (
    <section className="starpath-status motion-border spotlight-surface" onPointerMove={spotlightPointer}>
      <div className="starpath-visual">
        <AgenticOrbit paused={paused} label={paused ? "Run paused" : "Run in progress"} />
      </div>
      <div className="status-copy">
        <span className="eyebrow"><ShinyText>{paused ? "Safely paused" : "Agent working"}</ShinyText></span>
        <h2>{paused ? "Execution paused safely" : action.title}</h2>
        <p>{action.detail}</p>
        <div className="status-facts">
          <span><small>Milestone</small><strong>{action.milestone}</strong></span>
          <span><small>Elapsed time</small><strong>{action.elapsed}</strong></span>
          <span><small>Tool</small><strong><TerminalWindowIcon /> {action.tool}</strong></span>
        </div>
        <div className="run-actions">
          <button className="button primary" onClick={onExecute}><PlayIcon weight="fill" /> Run stage</button>
          <button className="button primary" onClick={onToggle}>
            {paused ? <PlayIcon weight="fill" /> : <PauseIcon weight="fill" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button className="button secondary" onClick={onReview}>View changes</button>
        </div>
      </div>
    </section>
  );
}
