import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface PreviewWindow {
  loadURL(url: string): Promise<void>;
  title(): string;
  rootText(): Promise<string>;
  consoleErrors(): string[];
  capture(): Promise<Buffer>;
  destroy(): void;
}

export interface PreviewEvidence {
  url: string;
  title: string;
  rootText: string;
  consoleErrors: string[];
  screenshotDigest: string;
  verifiedAt: string;
}

interface RunningPreview {
  child: ChildProcess;
  evidence: PreviewEvidence;
}

function wait(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function availableLoopbackPort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("A loopback preview port could not be allocated."));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

export async function verifyPreviewIdentity(url: string, expectedTitle: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let detail = "Preview did not respond.";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(2_000) });
      const html = await response.text();
      if (!response.ok) detail = `Preview returned HTTP ${response.status}.`;
      else if (!html.includes(expectedTitle)) detail = `Preview response did not identify ${expectedTitle}.`;
      else return;
    } catch (error) {
      detail = error instanceof Error ? error.message : detail;
    }
    await wait(150);
  }
  throw new Error(`Host preview verification timed out: ${detail}`);
}

export class PreviewManager {
  private running = new Map<string, RunningPreview>();

  constructor(
    private evidenceRoot: string,
    private createWindow: () => PreviewWindow
  ) {}

  private async captureEvidence(sessionId: string, url: string) {
    await verifyPreviewIdentity(url, "<title>Asteria");
    const previewWindow = this.createWindow();
    try {
      await previewWindow.loadURL(url);
      const [rootText, capture] = await Promise.all([previewWindow.rootText(), previewWindow.capture()]);
      const evidenceDirectory = path.join(this.evidenceRoot, sessionId);
      await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
      await writeFile(path.join(evidenceDirectory, "preview.png"), capture, { mode: 0o600 });
      return {
        url,
        title: previewWindow.title(),
        rootText: rootText.slice(0, 500),
        consoleErrors: previewWindow.consoleErrors().slice(0, 20),
        screenshotDigest: createHash("sha256").update(capture).digest("hex"),
        verifiedAt: new Date().toISOString()
      } satisfies PreviewEvidence;
    } finally {
      previewWindow.destroy();
    }
  }

  async start(sessionId: string, repositoryPath: string): Promise<PreviewEvidence> {
    await this.stop(sessionId);
    const manifest = JSON.parse(await readFile(path.join(repositoryPath, "package.json"), "utf8")) as {
      name?: string;
      scripts?: Record<string, string>;
    };
    if (manifest.name !== "asteria" || !manifest.scripts?.preview) {
      throw new Error("The validated Asteria source does not expose an npm preview script.");
    }

    const port = await availableLoopbackPort();
    const url = `http://127.0.0.1:${port}/?screen=maintenance-radio`;
    const child = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
      cwd: repositoryPath,
      env: { ...process.env, BROWSER: "none", NO_COLOR: "1" },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let processOutput = "";
    const remember = (chunk: Buffer) => {
      processOutput = `${processOutput}${chunk.toString("utf8")}`.slice(-4_000);
    };
    child.stdout?.on("data", remember);
    child.stderr?.on("data", remember);

    try {
      await Promise.race([
        verifyPreviewIdentity(url, "<title>Asteria"),
        new Promise<never>((_resolve, reject) => child.once("exit", (code) => reject(new Error(`Preview exited with code ${code}.${processOutput ? ` ${processOutput.trim()}` : ""}`))))
      ]);
      const evidence = await this.captureEvidence(sessionId, url);
      this.running.set(sessionId, { child, evidence });
      return evidence;
    } catch (error) {
      child.kill("SIGTERM");
      throw error;
    }
  }

  evidence(sessionId: string) {
    return this.running.get(sessionId)?.evidence;
  }

  async verify(sessionId: string) {
    const current = this.running.get(sessionId);
    if (!current) throw new Error("No host preview is running for this session.");
    const evidence = await this.captureEvidence(sessionId, current.evidence.url);
    current.evidence = evidence;
    return evidence;
  }

  async stop(sessionId: string) {
    const current = this.running.get(sessionId);
    if (!current) return;
    this.running.delete(sessionId);
    if (current.child.exitCode === null && current.child.signalCode === null) current.child.kill("SIGTERM");
  }

  async close() {
    await Promise.all([...this.running.keys()].map((sessionId) => this.stop(sessionId)));
  }
}
