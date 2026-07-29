import {
  FileTextIcon,
  GearSixIcon,
  QuestionIcon,
  LightbulbIcon,
  ChartLineUpIcon,
  CodeIcon,
  KanbanIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  SparkleIcon,
  PlusIcon,
  StackIcon,
  PuzzlePieceIcon,
  SquaresFourIcon,
  UsersThreeIcon
  ,ChatCircleDotsIcon
} from "@phosphor-icons/react";
import { Brand } from "./Brand";
import type { Project } from "../types";

export type Screen = "projects" | "workflow" | "radio-chat" | "ideas" | "kanban" | "threads" | "artifacts" | "code" | "skills" | "insights" | "help" | "privacy" | "settings";

const items: Array<{ id: Screen; label: string; icon: typeof SquaresFourIcon }> = [
  { id: "projects", label: "All projects", icon: StackIcon },
  { id: "workflow", label: "Starpath", icon: SquaresFourIcon },
  { id: "radio-chat", label: "Chat with RaDio", icon: ChatCircleDotsIcon },
  { id: "ideas", label: "Signals", icon: LightbulbIcon },
  { id: "kanban", label: "Star Map", icon: KanbanIcon },
  { id: "threads", label: "Constellations", icon: UsersThreeIcon },
  { id: "artifacts", label: "Observations", icon: FileTextIcon },
  { id: "code", label: "Code", icon: CodeIcon },
  { id: "skills", label: "RaDio skills", icon: PuzzlePieceIcon },
  { id: "insights", label: "Local insights", icon: ChartLineUpIcon },
  { id: "help", label: "Help & process", icon: QuestionIcon },
  { id: "privacy", label: "Privacy", icon: ShieldCheckIcon },
  { id: "settings", label: "Settings", icon: GearSixIcon }
];

export function Sidebar({ screen, onChange, projects, activeProjectId, onProjectChange, onNewProject }: {
  screen: Screen;
  onChange: (screen: Screen) => void;
  projects: Project[];
  activeProjectId: string;
  onProjectChange: (projectId: string) => void;
  onNewProject: () => void;
}) {
  return (
    <aside className="sidebar">
      <Brand />
      <div className="eyebrow app-mode"><SparkleIcon weight="fill" /> Observatory</div>
      <label className="project-picker">
        <span>Active project</span>
        <select value={activeProjectId} onChange={(event) => onProjectChange(event.target.value)}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <small>{projects.find((project) => project.id === activeProjectId)?.repository}</small>
      </label>
      <button className="new-project-button" onClick={onNewProject}><PlusIcon weight="bold" /> New project</button>
      <nav aria-label="Primary navigation">
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} className={screen === id ? "nav-item active" : "nav-item"} onClick={() => onChange(id)}>
            <Icon size={19} weight={screen === id ? "duotone" : "regular"} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <button className="privacy-card" onClick={() => onChange("privacy")}>
        <ShieldCheckIcon size={28} weight="duotone" />
        <span><strong>Privacy</strong><b>Local only</b><small>All app data stays on this machine.</small></span>
      </button>
      <div className="profile">
        <span className="avatar">RP</span>
        <span><strong>Rafael</strong><small>Local profile</small></span>
        <LockKeyIcon size={16} />
      </div>
    </aside>
  );
}
