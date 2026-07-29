import { useEffect, useMemo, useState } from "react";
import { CheckCircleIcon, HardDrivesIcon, PulseIcon, RobotIcon, WarningIcon } from "@phosphor-icons/react";
import type { Project, UserInstallState } from "../types";

export function MaintenanceRadioScreen({ projects, onOpenProject }: { projects: Project[]; onOpenProject: (projectId: string) => void }) {
  const [install, setInstall] = useState<UserInstallState>({ rollbackReady: false });
  useEffect(() => { void window.asteria?.installer.state().then(setInstall); }, []);
  const incidents = useMemo(() => projects.flatMap((project) => project.incidents.filter((incident) => incident.status !== "resolved").map((incident) => ({ project, incident }))), [projects]);
  const observations = useMemo(() => projects.reduce((total, project) => total + project.artifacts.length, 0), [projects]);
  return <div className="screen maintenance-radio-screen">
    <header className="screen-header"><div><span className="eyebrow">Application maintenance</span><h1><RobotIcon weight="duotone" /> Maintenance RaDio</h1><p>This RaDio view is limited to Asteria health, installation state, recovery, and maintenance reports.</p></div></header>
    <section className="maintenance-summary">
      <article><PulseIcon /><span><small>Application health</small><strong>{incidents.length ? "Attention required" : "Healthy"}</strong><p>{incidents.length} unresolved incident{incidents.length === 1 ? "" : "s"} across {projects.length} Orbits</p></span></article>
      <article><HardDrivesIcon /><span><small>Installed release</small><strong>{install.currentVersion ?? "Development"}</strong><p>{install.rollbackReady ? `Rollback ready${install.previousVersion ? ` · ${install.previousVersion}` : ""}` : "No previous user release"}</p></span></article>
      <article><CheckCircleIcon /><span><small>Maintenance reports</small><strong>{observations}</strong><p>Encrypted local Observations available</p></span></article>
    </section>
    <section className="maintenance-feed">
      <header><div><span className="eyebrow">Health queue</span><h2>App maintenance and reports</h2></div><span className={incidents.length ? "warning" : "success"}>{incidents.length ? "Needs review" : "All clear"}</span></header>
      {incidents.length ? incidents.map(({ project, incident }) => <button key={incident.id} onClick={() => onOpenProject(project.id)}><WarningIcon /><span><strong>{incident.title}</strong><small>{project.name} · {incident.owner} Star · {incident.status}</small><p>{incident.detail}</p></span><b>Open Orbit</b></button>) : <div className="maintenance-empty"><CheckCircleIcon weight="duotone" /><h3>No unresolved maintenance incidents</h3><p>RaDio is monitoring renderer, Electron, storage, provider, build, installation, and startup health.</p></div>}
    </section>
  </div>;
}
