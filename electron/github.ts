import { safeStorage } from "electron";
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import type { CheckRun, GitHubBranch, GitHubCommit, GitHubConnection, GitHubFile, GitHubIssue, GitHubTreeEntry, MergeResult, PullRequest, Review } from "../src/types.js";

let encryptedToken: Buffer | undefined;
let tokenPath: string | undefined;
let connectedLogin: string | undefined;
let lastRateLimit: GitHubConnection["rateLimit"];
const fixture = process.env.ASTERIA_GITHUB_FIXTURE === "1";

export function configureGitHubStorage(dataRoot: string) {
  tokenPath = path.join(dataRoot, "vault", "github-token.bin");
  mkdirSync(path.dirname(tokenPath), { recursive: true, mode: 0o700 });
  if (existsSync(tokenPath)) encryptedToken = readFileSync(tokenPath);
  if (fixture) connectedLogin = "asteria-fixture";
}

function persistToken(token: string, login?: string) {
  if (fixture) { connectedLogin = "asteria-fixture"; return; }
  if (!safeStorage.isEncryptionAvailable()) throw new Error("The OS credential vault is unavailable. Existing GitHub credentials were preserved.");
  encryptedToken = safeStorage.encryptString(JSON.stringify({ schemaVersion: 1, token, login }));
  if (tokenPath) writeFileSync(tokenPath, encryptedToken, { mode: 0o600 });
}

export function storeGitHubToken(token: string, login: string) {
  persistToken(token, login);
  connectedLogin = login;
}

export async function beginDeviceFlow(clientId: string) {
  if (fixture) return { deviceCode: "fixture-device-code", userCode: "OPEN-R123", verificationUri: "https://github.com/login/device", interval: 1 };
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, scope: "repo read:user workflow" })
  });
  if (!response.ok) throw new Error(`GitHub device flow failed (${response.status}).`);
  const body = await response.json() as { device_code: string; user_code: string; verification_uri: string; interval: number };
  return { deviceCode: body.device_code, userCode: body.user_code, verificationUri: body.verification_uri, interval: body.interval };
}

export async function pollDeviceFlow(clientId: string, deviceCode: string) {
  if (fixture) { persistToken("fixture"); return { connected: true, login: connectedLogin }; }
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" })
  });
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) return { connected: false };
  persistToken(body.access_token);
  const user = await githubRequest<{ login: string }>("/user");
  connectedLogin = user.login;
  persistToken(body.access_token, user.login);
  return { connected: true, login: user.login };
}

export function getGitHubToken() {
  if (fixture) return "fixture";
  if (!encryptedToken) return undefined;
  if (!safeStorage.isEncryptionAvailable()) throw new Error("GitHub credentials are locked because the OS credential vault is unavailable.");
  const decrypted = safeStorage.decryptString(encryptedToken);
  try {
    const payload = JSON.parse(decrypted) as { token?: string; login?: string };
    if (payload.login) connectedLogin = payload.login;
    return payload.token ?? decrypted;
  } catch {
    return decrypted;
  }
}

function fixtureResponse<T>(pathname: string, method: string, body?: Record<string, unknown>): T {
  if (pathname === "/user") return { login: "asteria-fixture" } as T;
  if (pathname.includes("/branches")) return [{ name: "main", commit: { sha: "fixture-sha" }, protected: true }] as T;
  if (pathname.includes("/git/trees/")) return { tree: [
    { path: "README.md", type: "blob", sha: "0000000000000000000000000000000000000001", size: 72 },
    { path: "src", type: "tree", sha: "0000000000000000000000000000000000000002" },
    { path: "src/App.tsx", type: "blob", sha: "0000000000000000000000000000000000000003", size: 76 }
  ], truncated: false } as T;
  if (pathname.includes("/git/blobs/")) return { content: Buffer.from(
    pathname.endsWith("1")
      ? "# Asteria fixture\n\nConnected GitHub source is available in the code browser.\n"
      : "export function App() {\n  return <main>GitHub source connected</main>;\n}\n"
  ).toString("base64"), encoding: "base64", size: 76 } as T;
  if (pathname.includes("/commits")) return [{ sha: "fixture-sha", commit: { message: "Fixture commit", author: { name: "Asteria", date: new Date().toISOString() } }, html_url: "https://github.com/asteria/fixture/commit/fixture-sha" }] as T;
  if (pathname.includes("/issues") && method === "POST") return { number: 2, title: body?.title, state: "open", html_url: "https://github.com/asteria/fixture/issues/2" } as T;
  if (pathname.includes("/issues") && method === "PATCH") return { number: 2, title: body?.title ?? "Fixture issue", state: body?.state ?? "open", html_url: "https://github.com/asteria/fixture/issues/2" } as T;
  if (pathname.includes("/issues") && !pathname.includes("/pulls")) return [{ number: 1, title: "Fixture issue", state: "open", html_url: "https://github.com/asteria/fixture/issues/1", pull_request: undefined }] as T;
  if (pathname.includes("/pulls") && method === "POST") return { number: 3, title: body?.title, state: "open", draft: body?.draft, html_url: "https://github.com/asteria/fixture/pull/3", head: { ref: body?.head }, base: { ref: body?.base } } as T;
  if (pathname.includes("/pulls") && method === "PATCH") return { number: 3, title: body?.title ?? "Fixture PR", state: body?.state ?? "open", draft: false, html_url: "https://github.com/asteria/fixture/pull/3", head: { ref: "feature" }, base: { ref: body?.base ?? "main" } } as T;
  if (pathname.endsWith("/merge")) return { merged: true, sha: "fixture-merge-sha", message: "Pull Request successfully merged" } as T;
  if (pathname.includes("/reviews") && method === "POST") return { id: 8, state: body?.event, body: body?.body, user: { login: "asteria-fixture" }, submitted_at: new Date().toISOString() } as T;
  if (pathname.includes("/reviews")) return [] as T;
  if (pathname.includes("/check-runs")) return { check_runs: [{ id: 4, name: "Fixture CI", status: "completed", conclusion: "success", html_url: "https://github.com/asteria/fixture/actions" }] } as T;
  if (pathname.includes("/pulls")) return [{ number: 1, title: "Fixture PR", state: "open", draft: false, html_url: "https://github.com/asteria/fixture/pull/1", head: { ref: "feature" }, base: { ref: "main" } }] as T;
  if (pathname.startsWith("/user/repos")) return [{ id: 1, full_name: "asteria/fixture", private: true, clone_url: process.cwd() }] as T;
  return {} as T;
}

async function githubRequest<T>(pathname: string, options: { method?: string; body?: Record<string, unknown> } = {}): Promise<T> {
  const method = options.method ?? "GET";
  if (fixture) return fixtureResponse<T>(pathname, method, options.body);
  const token = getGitHubToken();
  if (!token) throw new Error("Connect GitHub before using repository operations.");
  const response = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const remaining = Number(response.headers.get("x-ratelimit-remaining") ?? 0);
  const limit = Number(response.headers.get("x-ratelimit-limit") ?? 0);
  const reset = Number(response.headers.get("x-ratelimit-reset") ?? 0);
  lastRateLimit = { remaining, limit, resetAt: new Date(reset * 1000).toISOString() };
  if (response.status === 401) throw new Error("GitHub credentials expired or were revoked. Reconnect GitHub.");
  if (response.status === 403 && remaining === 0) throw new Error(`GitHub rate limit reached. Retry after ${lastRateLimit.resetAt}.`);
  if (!response.ok) throw new Error(`GitHub ${method} ${pathname} failed (${response.status}).`);
  return response.status === 204 ? undefined as T : await response.json() as T;
}

function repoPath(repository: string) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("Invalid GitHub repository name.");
  return `/repos/${repository}`;
}

export function connectionState(): GitHubConnection {
  if (encryptedToken && !connectedLogin) {
    try { void getGitHubToken(); } catch { /* Report the locked credential when an operation actually needs it. */ }
  }
  return { connected: fixture || Boolean(encryptedToken), login: connectedLogin, scopes: ["repo", "read:user", "workflow"], rateLimit: lastRateLimit };
}
export async function refreshConnectionState(): Promise<GitHubConnection> {
  const current = connectionState();
  if (!current.connected || current.login) return current;
  const user = await githubRequest<{ login: string }>("/user");
  connectedLogin = user.login;
  const token = getGitHubToken();
  if (token) persistToken(token, user.login);
  return connectionState();
}
export function disconnectGitHub() { encryptedToken = undefined; connectedLogin = undefined; if (tokenPath && existsSync(tokenPath)) unlinkSync(tokenPath); }
export async function revokeGitHub() {
  // Device-flow tokens cannot be revoked without a client secret. Local disconnect is immediate and complete.
  disconnectGitHub();
}
export async function listRepositories() {
  const body = await githubRequest<Array<{ id: number; full_name: string; private: boolean; clone_url: string }>>("/user/repos?sort=updated&per_page=100");
  return body.map((repository) => ({ id: repository.id, fullName: repository.full_name, private: repository.private, cloneUrl: repository.clone_url }));
}
export async function listBranches(repository: string): Promise<GitHubBranch[]> {
  const body = await githubRequest<Array<{ name: string; commit: { sha: string }; protected: boolean }>>(`${repoPath(repository)}/branches?per_page=100`);
  return body.map((branch) => ({ name: branch.name, sha: branch.commit.sha, protected: branch.protected }));
}
export async function getTree(repository: string, ref: string): Promise<GitHubTreeEntry[]> {
  const body = await githubRequest<{ tree: GitHubTreeEntry[]; truncated: boolean }>(
    `${repoPath(repository)}/git/trees/${encodeURIComponent(ref)}?recursive=1`
  );
  if (body.truncated) throw new Error("This repository tree is too large for GitHub's recursive listing.");
  return body.tree.filter((entry) => entry.type === "blob" || entry.type === "tree");
}
export async function getFile(repository: string, sha: string, filePath: string): Promise<GitHubFile> {
  const body = await githubRequest<{ content: string; encoding: string; size: number }>(`${repoPath(repository)}/git/blobs/${sha}`);
  if (body.encoding !== "base64") throw new Error("GitHub returned an unsupported file encoding.");
  if (body.size > 1_000_000) throw new Error("Files larger than 1 MB are not displayed.");
  const bytes = Buffer.from(body.content.replaceAll("\n", ""), "base64");
  if (bytes.includes(0)) throw new Error("Binary files are not displayed.");
  return { path: filePath, sha, size: body.size, content: bytes.toString("utf8"), encoding: "utf-8" };
}
export async function listCommits(repository: string, ref = "", page = 1): Promise<GitHubCommit[]> {
  const body = await githubRequest<Array<{ sha: string; commit: { message: string; author?: { name: string; date: string } }; html_url: string }>>(`${repoPath(repository)}/commits?per_page=100&page=${page}${ref ? `&sha=${encodeURIComponent(ref)}` : ""}`);
  return body.map((commit) => ({ sha: commit.sha, message: commit.commit.message, author: commit.commit.author?.name, timestamp: commit.commit.author?.date, url: commit.html_url }));
}
export async function listIssues(repository: string, page = 1): Promise<GitHubIssue[]> {
  const body = await githubRequest<Array<{ number: number; title: string; state: "open" | "closed"; html_url: string; pull_request?: unknown }>>(`${repoPath(repository)}/issues?state=all&per_page=100&page=${page}`);
  return body.filter((issue) => !issue.pull_request).map((issue) => ({ number: issue.number, title: issue.title, state: issue.state, url: issue.html_url }));
}
export async function createIssue(repository: string, title: string, body: string): Promise<GitHubIssue> {
  const issue = await githubRequest<{ number: number; title: string; state: "open"; html_url: string }>(`${repoPath(repository)}/issues`, { method: "POST", body: { title, body } });
  return { number: issue.number, title: issue.title, state: issue.state, url: issue.html_url };
}
export async function updateIssue(repository: string, issueNumber: number, patch: { title?: string; body?: string; state?: "open" | "closed" }): Promise<GitHubIssue> {
  const issue = await githubRequest<{ number: number; title: string; state: "open" | "closed"; html_url: string }>(`${repoPath(repository)}/issues/${issueNumber}`, { method: "PATCH", body: patch });
  return { number: issue.number, title: issue.title, state: issue.state, url: issue.html_url };
}
export async function listPullRequests(repository: string, page = 1): Promise<PullRequest[]> {
  const body = await githubRequest<Array<{ number: number; title: string; state: "open" | "closed"; draft: boolean; html_url: string; head: { ref: string }; base: { ref: string } }>>(`${repoPath(repository)}/pulls?state=all&per_page=100&page=${page}`);
  return body.map((pull) => ({ number: pull.number, title: pull.title, state: pull.state, draft: pull.draft, url: pull.html_url, head: pull.head.ref, base: pull.base.ref }));
}
export async function createPullRequest(repository: string, title: string, body: string, head: string, base: string, draft: boolean): Promise<PullRequest> {
  const pull = await githubRequest<{ number: number; title: string; state: "open"; draft: boolean; html_url: string; head: { ref: string }; base: { ref: string } }>(`${repoPath(repository)}/pulls`, { method: "POST", body: { title, body, head, base, draft } });
  return { number: pull.number, title: pull.title, state: pull.state, draft: pull.draft, url: pull.html_url, head: pull.head.ref, base: pull.base.ref };
}
export async function updatePullRequest(repository: string, pullNumber: number, patch: { title?: string; body?: string; state?: "open" | "closed"; base?: string }): Promise<PullRequest> {
  const pull = await githubRequest<{ number: number; title: string; state: "open" | "closed"; draft: boolean; html_url: string; head: { ref: string }; base: { ref: string } }>(`${repoPath(repository)}/pulls/${pullNumber}`, { method: "PATCH", body: patch });
  return { number: pull.number, title: pull.title, state: pull.state, draft: pull.draft, url: pull.html_url, head: pull.head.ref, base: pull.base.ref };
}
export async function deleteBranch(repository: string, branch: string) {
  await githubRequest<void>(`${repoPath(repository)}/git/refs/heads/${encodeURIComponent(branch)}`, { method: "DELETE" });
}
export async function listChecks(repository: string, ref: string): Promise<CheckRun[]> {
  const body = await githubRequest<{ check_runs: Array<{ id: number; name: string; status: string; conclusion?: string; html_url?: string }> }>(`${repoPath(repository)}/commits/${encodeURIComponent(ref)}/check-runs`);
  return body.check_runs.map((check) => ({ id: check.id, name: check.name, status: check.status, conclusion: check.conclusion, url: check.html_url }));
}
export async function listReviews(repository: string, pullNumber: number): Promise<Review[]> {
  const body = await githubRequest<Array<{ id: number; state: string; body: string; user?: { login: string }; submitted_at?: string }>>(`${repoPath(repository)}/pulls/${pullNumber}/reviews`);
  return body.map((review) => ({ id: review.id, state: review.state, body: review.body, author: review.user?.login, submittedAt: review.submitted_at }));
}
export async function submitReview(repository: string, pullNumber: number, body: string, event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"): Promise<Review> {
  const review = await githubRequest<{ id: number; state: string; body: string; user?: { login: string }; submitted_at?: string }>(`${repoPath(repository)}/pulls/${pullNumber}/reviews`, { method: "POST", body: { body, event } });
  return { id: review.id, state: review.state, body: review.body, author: review.user?.login, submittedAt: review.submitted_at };
}
export async function mergePullRequest(repository: string, pullNumber: number, method: "merge" | "squash" | "rebase"): Promise<MergeResult> {
  const result = await githubRequest<{ merged: boolean; sha?: string; message: string }>(`${repoPath(repository)}/pulls/${pullNumber}/merge`, { method: "PUT", body: { merge_method: method } });
  return result;
}
