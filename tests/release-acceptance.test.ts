import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("release acceptance gates", () => {
  const workflow = readFileSync(".github/workflows/release.yml", "utf8");
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as { build: { appId: string; productName: string; linux: { icon: string } } };
  it("never publishes automatically", () => {
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("--publish never");
    expect(workflow).not.toMatch(/electron-builder[^\n]*--publish (always|onTag)/);
  });
  it("keeps GitHub OAuth and platform signing credential gated", () => {
    expect(workflow).toContain("ASTERIA_GITHUB_CLIENT_ID");
    expect(workflow).toContain("APPLE_TEAM_ID");
    expect(workflow).toContain("WIN_CSC_LINK");
  });
  it("packages the Asteria identity and a concrete Linux icon source", () => {
    expect(manifest.build.appId).toBe("dev.asteria.desktop");
    expect(manifest.build.productName).toBe("Asteria");
    expect(manifest.build.linux.icon).toBe("build/icons/512x512/apps/asteria.png");
    for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
      expect(() => readFileSync(`build/icons/${size}x${size}/apps/asteria.png`)).not.toThrow();
    }
  });
  it("uses the crash-resistant Linux rendering path for installed launches", () => {
    const installer = readFileSync("scripts/install-user-release.mjs", "utf8");
    const main = readFileSync("electron/main.ts", "utf8");
    expect(installer).toContain('const launchArguments = ["--ozone-platform=x11", "--disable-gpu", "--no-sandbox"]');
    expect(installer).toContain('launchArguments.join(" ")');
    expect(installer).toContain('StartupWMClass=asteria');
    expect(installer).toContain('StartupNotify=true');
    expect(installer).toContain('chmodSync(desktopEntry, 0o755)');
    expect(main).toContain("app.disableHardwareAcceleration()");
    expect(main).toContain('app.commandLine.appendSwitch("no-sandbox")');
    expect(main).toContain("screen.getDisplayNearestPoint(screen.getCursorScreenPoint())");
  });
  it("stages Debian packages where APT's sandbox can read them", () => {
    const installer = readFileSync("scripts/install-linux-package.mjs", "utf8");
    expect(installer).toContain('mkdtempSync(path.join(os.tmpdir(), "asteria-deb-"))');
    expect(installer).toContain("chmodSync(stagingRoot, 0o755)");
    expect(installer).toContain("chmodSync(stagedPackage, 0o644)");
    expect(installer).toContain('["apt-get", "install", "-y", stagedPackage]');
    expect(installer).toContain("rmSync(stagingRoot, { recursive: true, force: true })");
  });
  it("repairs user-release permissions during installs and upgrades", () => {
    const installer = readFileSync("scripts/install-user-release.mjs", "utf8");
    expect(installer).toContain("chmodSync(directory, mode)");
    expect(installer).toContain("hardenPrivateTree(profile)");
    expect(installer).toContain("hardenPrivateTree(releaseStateRoot)");
    expect(installer).toContain("stat.isSymbolicLink()");
    expect(installer).toContain('process.on("uncaughtException", recoverFromFatalError)');
    expect(installer).toContain('process.on("unhandledRejection", recoverFromFatalError)');
    expect(installer).toContain('status: "failed"');
    expect(installer).toContain("launchKnownGood()");
  });
  it("bootstraps exact-revision dependencies before self-install verification", () => {
    const installer = readFileSync("electron/radio/user-installer.ts", "utf8");
    expect(installer).toContain('await runInRepository(root, "npm", ["ci", "--prefer-offline", "--no-audit"])');
    expect(installer).toContain("await bootstrapAsteriaDependencies(root)");
    expect(installer.indexOf("await bootstrapAsteriaDependencies(root)")).toBeLessThan(installer.indexOf('await run("npm", ["run", "typecheck"])'));
  });
  it("builds an isolated production client before starting host preview", () => {
    const installer = readFileSync("electron/radio/user-installer.ts", "utf8");
    const main = readFileSync("electron/main.ts", "utf8");
    expect(installer).toContain('await runInRepository(root, "npm", ["run", "build:web"])');
    expect(main).toContain("await prepareAsteriaPreview(workspace)");
    expect(main.indexOf("await prepareAsteriaPreview(workspace)")).toBeLessThan(main.indexOf("previewManager.start(sessionId, workspace)"));
  });
  it("collects complete dependency trees without shell execution during packaging", () => {
    const patcher = readFileSync("scripts/patch-electron-builder.mjs", "utf8");
    expect(patcher).toContain("execFileSync");
    expect(patcher).toContain("maxBuffer: 64 * 1024 * 1024");
    expect(patcher).toContain("shell: false");
  });
});
