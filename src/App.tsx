import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ApprovalSheet } from "./components/ApprovalSheet";
import { AppDialog, type DialogModel } from "./components/AppDialog";
import { RecoveryState } from "./components/RecoveryState";
import { Sidebar, type Screen } from "./components/Sidebar";
import { projects as demoProjects } from "./data";
import { ArtifactsScreen } from "./screens/ArtifactsScreen";
import { InsightsScreen } from "./screens/InsightsScreen";
import { KanbanScreen } from "./screens/KanbanScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { PrivacyScreen } from "./screens/PrivacyScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { ThreadsScreen } from "./screens/ThreadsScreen";
import { WorkflowScreen } from "./screens/WorkflowScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { CodeScreen } from "./screens/CodeScreen";
import { HelpScreen } from "./screens/HelpScreen";
import { IdeasScreen } from "./screens/IdeasScreen";
import type { Project, ProviderId } from "./types";

interface AsteriaHistoryState {
  asteria: true;
  screen: Screen;
  projectId?: string;
  onboarding?: boolean;
}

export function App() {
  const previewScreen = new URLSearchParams(window.location.search).get("screen");
  const [onboarded, setOnboarded] = useState(() => previewScreen !== null || (!window.asteria && localStorage.getItem("asteria.onboarded") === "true"));
  const [projects, setProjects] = useState<Project[]>(() => window.asteria ? [] : demoProjects);
  const [screen, setScreen] = useState<Screen>(() => previewScreen && ["projects", "workflow", "ideas", "kanban", "threads", "artifacts", "code", "insights", "help", "privacy", "settings"].includes(previewScreen) ? previewScreen as Screen : "workflow");
  const [activeProjectId, setActiveProjectId] = useState(() => localStorage.getItem("asteria.activeProject") ?? demoProjects[0].id);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const [pausedProjects, setPausedProjects] = useState<Record<string, boolean>>({});
  const [approvalProject, setApprovalProject] = useState<string | null>(null);
  const [auditCount] = useState(1);
  const [loading, setLoading] = useState(Boolean(window.asteria));
  const [dialog, setDialog] = useState<DialogModel | null>(null);

  useEffect(() => {
    if (!window.asteria) return;
    void window.asteria.projects.list().then((stored) => {
      if (stored.length) {
        setProjects(stored);
        setActiveProjectId((current) => stored.some((project) => project.id === current) ? current : stored[0].id);
        setOnboarded(true);
      } else {
        setProjects([]);
        setOnboarded(false);
      }
    }).catch((error) => setDialog({ title: "Project recovery needs attention", detail: error instanceof Error ? error.message : "Asteria could not reconstruct the saved project state.", copyable: true })).finally(() => setLoading(false));
  }, []);
  useEffect(() => window.asteria?.projects.subscribe((updated) => {
    setProjects((current) => current.map((project) => project.id === updated.id ? updated : project));
  }), []);

  useEffect(() => {
    if (loading) return;
    const initial: AsteriaHistoryState = { asteria: true, screen, projectId: activeProject?.id, onboarding: !onboarded };
    if (!(window.history.state as AsteriaHistoryState | null)?.asteria) window.history.replaceState(initial, "");
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as AsteriaHistoryState | null;
      if (!state?.asteria) return;
      if (state.projectId && projects.some((project) => project.id === state.projectId)) {
        setActiveProjectId(state.projectId);
        localStorage.setItem("asteria.activeProject", state.projectId);
      }
      setScreen(state.screen);
      setOnboarded(!state.onboarding);
      setApprovalProject(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [loading, projects, activeProject?.id, onboarded, screen]);

  const pushHistory = (nextScreen: Screen, projectId = activeProject?.id, onboarding = false, replace = false) => {
    const state: AsteriaHistoryState = { asteria: true, screen: nextScreen, projectId, onboarding };
    window.history[replace ? "replaceState" : "pushState"](state, "");
  };
  const navigate = (nextScreen: Screen) => {
    if (nextScreen === screen && onboarded) return;
    setScreen(nextScreen);
    setOnboarded(true);
    setApprovalProject(null);
    pushHistory(nextScreen);
  };
  const selectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    localStorage.setItem("asteria.activeProject", projectId);
    setApprovalProject(null);
    setScreen("workflow");
    setOnboarded(true);
    pushHistory("workflow", projectId);
  };
  const startNewProject = () => {
    setOnboarded(false);
    setApprovalProject(null);
    pushHistory("projects", activeProject?.id, true);
  };
  const cancelNewProject = () => {
    setOnboarded(true);
    setScreen("projects");
    setApprovalProject(null);
    pushHistory("projects", activeProject?.id, false, true);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setApprovalProject(null);
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        window.history.back();
      }
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        window.history.forward();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        navigate("workflow");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeProject?.id, onboarded, screen]);

  if (loading) return <RecoveryState kind="loading" />;
  if (!onboarded) return <OnboardingScreen existingProjectCount={projects.length} onCancel={projects.length ? cancelNewProject : undefined} onComplete={(project) => {
    setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
    setActiveProjectId(project.id);
    setOnboarded(true);
    setScreen("workflow");
    pushHistory("workflow", project.id, false, true);
    localStorage.setItem("asteria.onboarded", "true");
  }} onExplore={() => { setOnboarded(true); setScreen("projects"); pushHistory("projects", activeProject?.id, false, true); localStorage.setItem("asteria.onboarded", "true"); }} />;

  const applyProvider = (provider: ProviderId) => {
    setProjects((current) => current.map((project) => project.id === activeProject.id ? { ...project, provider } : project));
    if (window.asteria) void window.asteria.projects.update({
      projectId: activeProject.id, runId: activeProject.runId, expectedVersion: activeProject.version,
      idempotencyKey: `provider_${crypto.randomUUID()}`, patch: { provider }
    }).then((updated) => setProjects((current) => current.map((project) => project.id === updated.id ? updated : project))).catch(() => undefined);
  };
  const changeProvider = (provider: ProviderId) => {
    if (provider === activeProject.provider) return;
    const requirements = activeProject.tasks.flatMap((task) => task.requirementIds ?? []).length;
    setDialog({
      title: `Review handoff to ${provider === "codex" ? "OpenAI Codex" : "Claude Code"}`,
      detail: `Target provider: ${provider}\nRun: ${activeProject.runId}\nWorktree: ${activeProject.repositoryPath ?? "Not registered"}\nRequirements: ${requirements}\nArtifacts: ${activeProject.artifacts.length}\nBudget remaining: ${Math.max(0, activeProject.budget.tokenLimit - activeProject.budget.usedTokens).toLocaleString()} tokens\n\nOnly this redacted project context is handed off. Ordinary provider profiles are not read.`,
      confirmLabel: "Approve handoff",
      cancelLabel: "Keep provider",
      onConfirm: () => applyProvider(provider)
    });
  };
  const replaceProject = (updated: Project) => setProjects((current) => current.map((project) => project.id === updated.id ? updated : project));
  const pendingApproval = activeProject.approvals?.find((approval) => approval.status === "pending");
  const decideApproval = async (decision: "approved" | "denied") => {
    if (!pendingApproval) { setApprovalProject(null); return; }
    if (window.asteria) {
      const updated = await window.asteria.approvals.decide({
        projectId: activeProject.id, runId: activeProject.runId, expectedVersion: activeProject.version,
        idempotencyKey: `approval_${crypto.randomUUID()}`, approvalId: pendingApproval.id, decision, decisionToken: pendingApproval.decisionToken
      });
      replaceProject(updated);
    } else {
      replaceProject({ ...activeProject, version: activeProject.version + 1, approvals: activeProject.approvals.map((approval) => approval.id === pendingApproval.id ? { ...approval, status: decision } : approval) });
    }
    setApprovalProject(null);
  };
  const togglePause = async () => {
    const paused = Boolean(pausedProjects[activeProject.id]);
    if (window.asteria) {
      const updated = await window.asteria.workflows.advance({
        projectId: activeProject.id, runId: activeProject.runId, expectedVersion: activeProject.version,
        idempotencyKey: `pause_${crypto.randomUUID()}`, event: paused ? "resume" : "pause"
      });
      replaceProject(updated);
    }
    setPausedProjects((current) => ({ ...current, [activeProject.id]: !paused }));
  };
  const executeStage = async () => {
    if (!window.asteria) return;
    try {
      replaceProject(await window.asteria.workflows.execute({
        projectId: activeProject.id, runId: activeProject.runId, expectedVersion: activeProject.version,
        idempotencyKey: `execute_${crypto.randomUUID()}`
      }));
    } catch (error) {
      setDialog({ title: "Stage could not start", detail: error instanceof Error ? error.message : "Stage execution could not start.", copyable: true });
    }
  };

  const page = (() => {
    if (screen === "projects") return <ProjectsScreen projects={projects} activeProjectId={activeProject.id} onOpen={selectProject} onNew={startNewProject} />;
    if (screen === "workflow") return <WorkflowScreen project={activeProject} provider={activeProject.provider} onProvider={changeProvider} paused={Boolean(pausedProjects[activeProject.id])} onPause={() => void togglePause()} onExecute={() => void executeStage()} onApproval={() => setApprovalProject(activeProject.id)} onBack={() => navigate("projects")} />;
    if (screen === "ideas") return <IdeasScreen project={activeProject} onProject={replaceProject} />;
    if (screen === "kanban") return <KanbanScreen project={activeProject} onProject={replaceProject} />;
    if (screen === "threads") return <ThreadsScreen project={activeProject} onProject={replaceProject} />;
    if (screen === "artifacts") return <ArtifactsScreen project={activeProject} onProject={replaceProject} />;
    if (screen === "code") return <CodeScreen project={activeProject} />;
    if (screen === "insights") return <InsightsScreen project={activeProject} />;
    if (screen === "help") return <HelpScreen />;
    if (screen === "privacy") return <PrivacyScreen auditCount={auditCount} onDialog={setDialog} />;
    return <SettingsScreen project={activeProject} onProject={replaceProject} />;
  })();

  return (
    <div className="app-shell">
      <Sidebar screen={screen} onChange={navigate} projects={projects} activeProjectId={activeProject.id} onProjectChange={selectProject} onNewProject={startNewProject} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={`${activeProject.id}:${screen}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
          {page}
        </motion.main>
      </AnimatePresence>
      <ApprovalSheet open={approvalProject === activeProject.id} request={pendingApproval} onClose={() => setApprovalProject(null)} onApprove={() => void decideApproval("approved")} onDeny={() => void decideApproval("denied")} />
      <AppDialog model={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
