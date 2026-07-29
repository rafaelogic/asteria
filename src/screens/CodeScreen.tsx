import { useEffect, useMemo, useState } from "react";
import { ArrowClockwiseIcon, CodeIcon, FileIcon, FolderIcon, GithubLogoIcon, LockKeyIcon } from "@phosphor-icons/react";
import type { GitHubBranch, GitHubConnection, GitHubFile, GitHubTreeEntry, Project } from "../types";
import { CodePreview, MarkdownPreview } from "../components/RichPreview";

const demoTree: GitHubTreeEntry[] = [
  { path: "README.md", type: "blob", sha: "demo-readme", size: 164 },
  { path: "src", type: "tree", sha: "demo-src" },
  { path: "src/App.tsx", type: "blob", sha: "demo-app", size: 152 },
  { path: "src/main.tsx", type: "blob", sha: "demo-main", size: 118 }
];
const demoFiles: Record<string, string> = {
  "README.md": "# Asteria Control Plane\n\nA private, project-isolated workspace for orchestrating specialist agents across a durable starpath workflow.\n",
  "src/App.tsx": "import { WorkflowScreen } from \"./screens/WorkflowScreen\";\n\nexport function App() {\n  return <WorkflowScreen />;\n}\n",
  "src/main.tsx": "import { createRoot } from \"react-dom/client\";\nimport { App } from \"./App\";\n\ncreateRoot(document.getElementById(\"root\")!).render(<App />);\n"
};

export function CodeScreen({ project }: { project: Project }) {
  const storageKey = `asteria.github.code.${project.id}`;
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as { branch?: string; path?: string }; }
    catch { return {}; }
  })();
  const [connection, setConnection] = useState<GitHubConnection | null>(window.asteria ? null : { connected: true, login: "preview", scopes: ["repo"] });
  const [branches, setBranches] = useState<GitHubBranch[]>(window.asteria ? [] : [{ name: "main", sha: "demo", protected: true }]);
  const [branch, setBranch] = useState(saved.branch ?? "main");
  const [tree, setTree] = useState<GitHubTreeEntry[]>(window.asteria ? [] : demoTree);
  const initialDemoPath = demoFiles[saved.path ?? ""] ? saved.path! : "README.md";
  const [file, setFile] = useState<GitHubFile | null>(window.asteria ? null : {
    path: initialDemoPath, sha: `demo-${initialDemoPath}`, size: demoFiles[initialDemoPath].length,
    content: demoFiles[initialDemoPath], encoding: "utf-8"
  });
  const [selectedPath, setSelectedPath] = useState(saved.path ?? "");
  const [loading, setLoading] = useState(Boolean(window.asteria));
  const [error, setError] = useState("");

  const files = useMemo(() => tree.filter((entry) => entry.type === "blob"), [tree]);

  useEffect(() => {
    setSelectedPath(saved.path ?? "");
    if (window.asteria) setFile(null);
    setError("");
    if (!window.asteria) return;
    setLoading(true);
    void window.asteria.github.connection().then(async (state) => {
      setConnection(state);
      if (!state.connected || project.visibility === "Local" || !project.repository.includes("/")) return;
      const nextBranches = await window.asteria!.github.branches(project.repository);
      setBranches(nextBranches);
      const nextBranch = nextBranches.some((item) => item.name === saved.branch) ? saved.branch! : nextBranches[0]?.name ?? "main";
      setBranch(nextBranch);
      setTree(await window.asteria!.github.tree(project.repository, nextBranch));
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "GitHub source could not be loaded."))
      .finally(() => setLoading(false));
  }, [project.id, project.repository]);

  useEffect(() => {
    if (!file && files.length) {
      const selected = files.find((entry) => entry.path === selectedPath) ?? files[0];
      void openFile(selected);
    }
  }, [files, selectedPath]);

  const persist = (nextBranch: string, path: string) => localStorage.setItem(storageKey, JSON.stringify({ branch: nextBranch, path }));
  const openFile = async (entry: GitHubTreeEntry) => {
    setSelectedPath(entry.path);
    persist(branch, entry.path);
    setError("");
    if (!window.asteria) {
      setFile({ path: entry.path, sha: entry.sha, size: entry.size ?? 0, content: demoFiles[entry.path] ?? "// Preview source", encoding: "utf-8" });
      return;
    }
    try {
      setFile(await window.asteria.github.file(project.repository, entry.sha, entry.path));
    } catch (reason) {
      setFile(null);
      setError(reason instanceof Error ? reason.message : "This file could not be displayed.");
    }
  };
  const changeBranch = async (nextBranch: string) => {
    setBranch(nextBranch);
    setSelectedPath("");
    setFile(null);
    persist(nextBranch, "");
    if (!window.asteria) return;
    setLoading(true);
    setError("");
    try { setTree(await window.asteria.github.tree(project.repository, nextBranch)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The branch could not be loaded."); }
    finally { setLoading(false); }
  };

  const unavailable = project.visibility === "Local" || !project.repository.includes("/");
  return <div className="screen standard-screen code-screen">
    <header className="section-header">
      <div><span className="eyebrow">{project.name} · Project source</span><h1>Code</h1><p>Browse the GitHub repository bound only to this project.</p></div>
      <span className="local-badge"><LockKeyIcon /> {connection?.login ? `GitHub · ${connection.login}` : "GitHub profile"}</span>
    </header>
    {loading ? <div className="code-empty"><ArrowClockwiseIcon className="spin" /><strong>Loading repository source…</strong></div>
      : !connection?.connected ? <div className="code-empty"><GithubLogoIcon /><strong>Connect GitHub to display code</strong><p>Authorize the isolated GitHub profile during onboarding, then return here.</p></div>
      : unavailable ? <div className="code-empty"><FolderIcon /><strong>This project uses a local repository</strong><p>GitHub code appears here after the project is bound to an owner/repository remote.</p></div>
      : <div className="code-workspace">
        <aside className="code-tree">
          <header><span><GithubLogoIcon /> {project.repository}</span><select aria-label="Branch" value={branch} onChange={(event) => void changeBranch(event.target.value)}>{branches.map((item) => <option key={item.name}>{item.name}</option>)}</select></header>
          <div className="code-file-list">{tree.map((entry) => entry.type === "tree"
            ? <div className="code-folder" key={entry.path}><FolderIcon weight="fill" /><span>{entry.path}</span></div>
            : <button className={selectedPath === entry.path ? "active" : ""} key={entry.path} onClick={() => void openFile(entry)}><FileIcon /><span>{entry.path}</span></button>)}</div>
        </aside>
        <section className="code-viewer">
          <header><span><CodeIcon /> {file?.path ?? "Select a file"}</span>{file && <small>{file.size.toLocaleString()} bytes · {branch}</small>}</header>
          {error ? <div className="code-error">{error}</div> : file?.path.endsWith(".md") ? <MarkdownPreview content={file.content} /> : <CodePreview code={file?.content ?? "Choose a source file from the repository tree."} path={file?.path ?? "text.txt"} />}
        </section>
      </div>}
  </div>;
}
