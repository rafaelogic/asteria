import { BookOpenTextIcon, CheckCircleIcon, CursorClickIcon, GitBranchIcon, KanbanIcon, PlayIcon, ShieldCheckIcon, SparkleIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";

const steps = [
  { icon: CursorClickIcon, title: "Choose an Orbit", text: "Every Orbit carries its own objective, provider, Starpath, tickets, evidence, and run state." },
  { icon: SparkleIcon, title: "Shape the prompt", text: "Describe the outcome, then use Improve writing to make the request clearer before it enters the workflow." },
  { icon: GitBranchIcon, title: "Follow the Starpath", text: "Stars move through Coordinates for definition, design, build, review, QA, audit, and release." },
  { icon: KanbanIcon, title: "Read the Star Map", text: "The Star Map shows ownership, provider, risk, requirements, dependencies, and attempts for every ticket." },
  { icon: CheckCircleIcon, title: "Review Observations", text: "Inspect Markdown, images, code, tests, and approvals in their native preview before release." }
];

export function HelpScreen() {
  return <div className="screen standard-screen help-screen">
    <header className="section-header"><div><span className="eyebrow">Asteria guide</span><h1>How an Orbit works</h1><p>A quick map from a rough signal to reviewable, project-scoped delivery.</p></div><span className="local-badge"><ShieldCheckIcon /> Local-only by design</span></header>
    <section className="help-hero motion-border">
      <span className="help-hero-icon"><BookOpenTextIcon weight="duotone" /></span>
      <div><small>Start here</small><h2>One objective. A visible chain of responsibility.</h2><p>Asteria turns your prompt into a staged workflow, assigns specialist agents, pauses at meaningful approvals, and keeps the evidence beside the work.</p></div>
      <button className="button primary"><PlayIcon weight="fill" /> Replay walkthrough</button>
    </section>
    <div className="flow-chart" aria-label="Asteria process flow">
      {steps.map(({ icon: Icon, title, text }, index) => <motion.article key={title} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .06 }}>
        <span className="flow-number">{String(index + 1).padStart(2, "0")}</span><span className="flow-icon"><Icon weight="duotone" /></span>
        <div><h3>{title}</h3><p>{text}</p></div>{index < steps.length - 1 && <i />}
      </motion.article>)}
    </div>
    <section className="help-tips"><h2>Good prompts make better starpaths</h2><div><span><strong>Name the outcome</strong><small>What should be true when the run is complete?</small></span><span><strong>Add constraints</strong><small>Call out privacy, platform, accessibility, or release requirements.</small></span><span><strong>Define evidence</strong><small>Say how the team should test and demonstrate success.</small></span></div></section>
  </div>;
}
