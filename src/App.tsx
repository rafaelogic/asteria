import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ApprovalSheet } from "./components/ApprovalSheet";
import { AppDialog, type DialogModel } from "./components/AppDialog";
import { RecoveryState } from "./components/RecoveryState";
import { Sidebar, type Screen } from "./components/Sidebar";
import { projects as demoProjects } from "./data";
import { ArtifactsScreen } from "./screens/ArtifactsScreen";
import { InsightsScreen } from "./screens/InsightsScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { PrivacyScreen } from "./screens/PrivacyScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { CodeScreen } from "./screens/CodeScreen";
import { HelpScreen } from "./screens/HelpScreen";
import { IdeasScreen } from "./screens/IdeasScreen";
import { SkillsScreen } from "./screens/SkillsScreen";
import { RadioChatScreen, MaintenanceRadioScreen, FloatingRaDio } from "../modules/radio/renderer/index";
import { KanbanScreen, ThreadsScreen, WorkflowScreen } from "../modules/stars/renderer/index";
import type { AuthorizationScope, Project, ProviderId } from "./types";
import { isApplicationWorkspace, workspaceHistoryProjectId } from "./workspace";

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
  const [screen, setScreen] = useState<Screen>(() => previewScreen && ["projects", "workflow", "radio-chat", "maintenance-radio", "ideas", "kanban", "threads", "artifacts", "code", "skills", "insights", "help", "privacy", "settings"].includes(previewScreen) ? previewScreen as Screen : "workflow");
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
    if (!window.asteria || !activeProject || isApplicationWorkspace(screen)) return;
    const report = (operation: string, value: unknown) => {
      const message = value instanceof Error ? value.message : typeof value === "string" ? value : "Unhandled renderer failure";
      void window.asteria?.radio.reportHealth({ projectId: activeProject.id, runId: activeProject.runId, source: "renderer", operation, message, severity: "error" }).catch(() => undefined);
    };
    const onError = (event: ErrorEvent) => report("window.error", event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => report("unhandledrejection", event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, [activeProject?.id, activeProject?.runId, screen]);

  useEffect(() => {
    if (loading) return;
    const initial: AsteriaHistoryState = { asteria: true, screen, projectId: workspaceHistoryProjectId(screen, activeProject?.id), onboarding: !onboarded };
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
    const state: AsteriaHistoryState = { asteria: true, screen: nextScreen, projectId: workspaceHistoryProjectId(nextScreen, projectId), onboarding };
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
  const pendingAuthorization = activeProject.authorizationRequests?.find((request) => request.state === "pending");
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
  const decideAuthorization = async (decision: "allow" | "deny", scope: AuthorizationScope) => {
    if (!pendingAuthorization || !window.asteria) return;
    try {
      if (decision === "allow" && pendingAuthorization.kind === "authentication" && pendingAuthorization.provider) {
        await window.asteria.providers.authenticate(pendingAuthorization.provider);
      }
      const updated = await window.asteria.authorization.decide({
        projectId: activeProject.id,
        runId: activeProject.runId,
        expectedVersion: activeProject.version,
        idempotencyKey: `authorization_${crypto.randomUUID()}`,
        authorizationId: pendingAuthorization.id,
        decisionToken: pendingAuthorization.decisionToken,
        decision,
        scope,
      });
      replaceProject(updated);
    } catch (error) {
      setDialog({ title: "Authorization could not be delivered", detail: error instanceof Error ? error.message : "Refresh the Orbit and try again." });
    }
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
      const detail = error instanceof Error ? error.message : "Stage execution could not start.";
      if (detail.includes("local repository is required")) {
        const canClone = activeProject.visibility !== "Local" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(activeProject.repository);
        setDialog({
          title: canClone ? "Choose where RaDio should store this project" : "Connect this project to its repository",
          detail: canClone
            ? `RaDio will clone ${activeProject.repository}, bind the resulting local Git repository to this Orbit, and retry the Coordinate.`
            : "This existing local project does not have a valid Git repository binding. Choose its repository root and Asteria will save the binding, then retry this Coordinate.",
          confirmLabel: canClone ? "Choose storage folder" : "Choose repository",
          cancelLabel: "Not now",
          onConfirm: () => { void attachRepositoryAndExecute(); }
        });
      } else {
        setDialog({ title: "Stage could not start", detail, copyable: true });
      }
    }
  };

  const attachRepositoryAndExecute = async () => {
    if (!window.asteria) return;
    try {
      const folder = await window.asteria.system.selectFolder();
      if (!folder) return;
      const canClone = activeProject.visibility !== "Local" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(activeProject.repository);
      const repositoryPath = canClone
        ? (await window.asteria.repositories.clone({
            cloneUrl: `https://github.com/${activeProject.repository}.git`,
            projectName: activeProject.name,
            storagePath: folder,
            idempotencyKey: `clone_${crypto.randomUUID()}`
          })).path
        : folder;
      await window.asteria.repositories.status(repositoryPath);
      const bound = await window.asteria.projects.update({
        projectId: activeProject.id,
        runId: activeProject.runId,
        expectedVersion: activeProject.version,
        idempotencyKey: `repository_${crypto.randomUUID()}`,
        patch: {
          repositoryPath,
          repository: activeProject.repository || repositoryPath.split(/[\\/]/).pop() || "Local repository"
        }
      });
      replaceProject(bound);
      replaceProject(await window.asteria.workflows.execute({
        projectId: bound.id,
        runId: bound.runId,
        expectedVersion: bound.version,
        idempotencyKey: `execute_${crypto.randomUUID()}`
      }));
    } catch (error) {
      setDialog({
        title: "Repository could not be connected",
        detail: error instanceof Error ? error.message : "Choose the root folder of a local Git repository.",
        copyable: true
      });
    }
  };

  const page = (() => {
    if (screen === "projects") return <ProjectsScreen projects={projects} activeProjectId={activeProject.id} onOpen={selectProject} onNew={startNewProject} />;
    if (screen === "workflow") return <WorkflowScreen project={activeProject} provider={activeProject.provider} onProvider={changeProvider} paused={Boolean(pausedProjects[activeProject.id])} onPause={() => void togglePause()} onExecute={() => void executeStage()} onApproval={() => setApprovalProject(activeProject.id)} onBack={() => navigate("projects")} />;
    if (screen === "radio-chat") return <RadioChatScreen project={activeProject} onProject={replaceProject} />;
    if (screen === "maintenance-radio") return <MaintenanceRadioScreen projects={projects} onReturn={() => navigate("projects")} />;
    if (screen === "ideas") return <IdeasScreen project={activeProject} onProject={replaceProject} />;
    if (screen === "kanban") return <KanbanScreen project={activeProject} onProject={replaceProject} />;
    if (screen === "threads") return <ThreadsScreen project={activeProject} onProject={replaceProject} />;
    if (screen === "artifacts") return <ArtifactsScreen project={activeProject} onProject={replaceProject} />;
    if (screen === "code") return <CodeScreen project={activeProject} />;
    if (screen === "skills") return <SkillsScreen project={activeProject} onProject={replaceProject} />;
    if (screen === "insights") return <InsightsScreen project={activeProject} />;
    if (screen === "help") return <HelpScreen />;
    if (screen === "privacy") return <PrivacyScreen auditCount={auditCount} onDialog={setDialog} />;
    return <SettingsScreen project={activeProject} onProject={replaceProject} />;
  })();

  if (isApplicationWorkspace(screen)) {
    return (
      <div className="maintenance-workspace">
        <motion.main key={screen} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {page}
        </motion.main>
        <AppDialog model={dialog} onClose={() => setDialog(null)} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar screen={screen} onChange={navigate} projects={projects} activeProjectId={activeProject.id} onProjectChange={selectProject} onNewProject={startNewProject} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={`${activeProject.id}:${screen}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
          {page}
        </motion.main>
      </AnimatePresence>
      {screen !== "radio-chat" && <FloatingRaDio project={activeProject} onProject={replaceProject} onMaximize={() => navigate("radio-chat")} />}
      <ApprovalSheet
        open={Boolean(pendingAuthorization) || approvalProject === activeProject.id}
        authorization={pendingAuthorization}
        request={pendingAuthorization ? undefined : pendingApproval}
        onClose={() => setApprovalProject(null)}
        onApprove={() => void decideApproval("approved")}
        onAuthorize={(scope) => void decideAuthorization("allow", scope)}
        onDeny={() => pendingAuthorization ? void decideAuthorization("deny", "once") : void decideApproval("denied")}
      />
      <AppDialog model={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
