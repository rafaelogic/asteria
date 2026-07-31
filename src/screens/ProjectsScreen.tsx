import {
  ArrowRightIcon,
  AtomIcon,
  CheckCircleIcon,
  ClockIcon,
  FolderOpenIcon,
  PlusIcon,
  StackIcon
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { ProviderMark } from "../components/ProviderMark";
import type { Project } from "../types";

export function ProjectsScreen({ projects, activeProjectId, onOpen, onNew }: {
  projects: Project[];
  activeProjectId: string;
  onOpen: (projectId: string) => void;
  onNew: () => void;
}) {
  const running = projects.filter((project) => project.runStatus === "active").length;
  const approvals = projects.reduce((count, project) => count
    + project.approvals.filter((approval) => approval.status === "pending").length
    + (project.authorizationRequests ?? []).filter((request) => request.state === "pending").length, 0);

  return (
    <div className="screen standard-screen projects-screen">
      <header className="section-header projects-header">
        <div>
          <span className="eyebrow">Local workspace library</span>
          <h1>Projects</h1>
          <p>Resume an starpath exactly where it stopped, or prepare a new isolated workspace.</p>
        </div>
        <button className="button primary" onClick={onNew}><PlusIcon weight="bold" /> New project</button>
      </header>

      <section className="project-summary" aria-label="Project summary">
        <span><StackIcon weight="duotone" /><small>Projects</small><strong>{projects.length}</strong></span>
        <span><AtomIcon weight="duotone" /><small>Active runs</small><strong>{running}</strong></span>
        <span><CheckCircleIcon weight="duotone" /><small>Awaiting approval</small><strong>{approvals}</strong></span>
      </section>

      <div className="project-library">
        {projects.map((project, index) => {
          const stage = project.workflow.find((step) => step.status === "active") ?? project.workflow.at(-1);
          const progress = Math.round(project.workflow.filter((step) => step.status === "complete").length / Math.max(1, project.workflow.length) * 100);
          const isActive = project.id === activeProjectId;
          return (
            <motion.button
              key={project.id}
              className={`project-library-card ${isActive ? "current" : ""}`}
              onClick={() => onOpen(project.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * .04, .2), duration: .22 }}
            >
              <header>
                <span className={`provider-orb ${project.provider}`}><ProviderMark provider={project.provider} size={19} /></span>
                <span className="project-card-state">{isActive ? "Current project" : project.runStatus}</span>
                <ArrowRightIcon className="project-open-arrow" />
              </header>
              <span className="project-card-title"><strong>{project.name}</strong><small>{project.visibility}</small></span>
              <p>{project.objective}</p>
              <span className="project-card-repository"><FolderOpenIcon /> {project.repository || project.repositoryPath || "Local repository"}</span>
              <span className="project-card-progress"><i><b style={{ width: `${progress}%` }} /></i><small>{stage?.name ?? "Ready"} · {progress}%</small></span>
              <footer><span><ClockIcon /> Updated {formatRelative(project.updatedAt)}</span><b>Open starpath</b></footer>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function formatRelative(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recently";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
