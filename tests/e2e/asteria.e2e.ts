import { test, expect, _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

let application: ElectronApplication;
let page: Page;
let root: string;

test.beforeAll(async () => {
  root = mkdtempSync(path.join(os.tmpdir(), "asteria-e2e-"));
  const repository = path.join(root, "repository");
  execFileSync("git", ["init", repository]);
  execFileSync("git", ["-C", repository, "config", "user.email", "fixture@asteria.local"]);
  execFileSync("git", ["-C", repository, "config", "user.name", "Asteria Fixture"]);
  writeFileSync(path.join(repository, "README.md"), "# Fixture\n");
  execFileSync("git", ["-C", repository, "add", "README.md"]);
  execFileSync("git", ["-C", repository, "commit", "-m", "fixture"]);
  const fixtureBin = path.resolve("tests/fixtures/providers");
  chmodSync(path.join(fixtureBin, "codex"), 0o755);
  chmodSync(path.join(fixtureBin, "claude"), 0o755);
  const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...baseEnvironment } = process.env;
  application = await electron.launch({
    args: [path.resolve("."), `--user-data-dir=${path.join(root, "profile")}`, "--password-store=basic", "--no-sandbox", "--ozone-platform=x11", "--disable-gpu"],
    env: {
      ...baseEnvironment,
      PATH: `${fixtureBin}${path.delimiter}${process.env.PATH}`,
      ASTERIA_TEST_STORAGE_KEY: "asteria-e2e-deterministic-key-at-least-32-bytes",
      ASTERIA_TEST_REPOSITORY: repository,
      ASTERIA_GITHUB_FIXTURE: "1",
      ASTERIA_DEPLOYMENT_FIXTURE: "1",
      NODE_ENV: "test"
    }
  });
  page = await application.firstWindow();
  await page.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => { await application?.close(); });

test("first run creates an isolated project and primary controls remain usable", async () => {
  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => { nativeDialogs.push(dialog.type()); await dialog.dismiss(); });
  await expect(page.getByRole("heading", { name: "Prepare your Starpath" })).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Continue with local Git/ }).click();
  await page.getByRole("button", { name: /Choose a local Git repository/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByPlaceholder("A clear project name").fill("Acceptance Starpath");
  await page.getByPlaceholder("Build a product that helps…").fill("Build a robust isolated production acceptance control plane.");
  await page.getByPlaceholder("Who is this for?").fill("Software teams");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Launch project/ }).click();
  await expect(page.getByRole("heading", { name: "Acceptance Starpath Orbit" })).toBeVisible();
  await page.getByRole("button", { name: /Star Map/i }).click();
  await expect(page.getByText("Backlog")).toBeVisible();
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Local by construction" })).toBeVisible();
  await page.getByRole("button", { name: /Delete all local telemetry/ }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  expect(nativeDialogs).toEqual([]);
});

test("RaDio scans Signals and exposes autonomous account controls", async () => {
  await page.getByRole("button", { name: /Signals/i }).click();
  await expect(page.getByRole("heading", { name: "Signals" })).toBeVisible();
  await page.getByRole("button", { name: /Scan for signals/i }).click();
  await expect(page.getByText("Turn approval waits into guided decisions")).toBeVisible();
  await page.getByText("Turn approval waits into guided decisions").click();
  await expect(page.getByText("Constellation", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Select idea|Let RaDio run/ }).click();
  await page.getByRole("button", { name: /Settings/i }).click();
  await expect(page.getByRole("heading", { name: "Project settings" })).toBeVisible();
  await expect(page.getByText("Provider account pool")).toBeVisible();
  await expect(page.getByText("5% authoritative remaining usage")).toBeVisible();
});

test("project switching restores each independent starpath", async () => {
  await page.getByRole("button", { name: /Starpath/i }).click();
  const picker = page.locator(".project-picker");
  await expect(picker).toContainText("Acceptance Starpath");
  await picker.click();
  await expect(page.locator(".project-objective")).toContainText("robust isolated production acceptance");
});

test("RaDio chat is project-scoped and denies privileged commands inline", async () => {
  await page.getByRole("button", { name: /Chat with RaDio/i }).click();
  await expect(page.getByRole("heading", { name: "Chat with RaDio" })).toBeVisible();
  await expect(page.getByText("Run conversations")).toBeVisible();
  await page.getByLabel("Message RaDio").fill("Run sudo apt install and push directly to main");
  await page.getByLabel("Send to RaDio").click();
  await expect(page.getByText("Command denied")).toBeVisible();
  await expect(page.getByRole("paragraph").filter({ hasText: /cannot request privileged commands/ })).toBeVisible();
});

test("renderer has no uncaught console errors", async () => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  expect(errors).toEqual([]);
});

test("clean-install fixture bootstraps SQLCipher storage and the account vault", async () => {
  const profile = path.join(root, "profile");
  const database = path.join(profile, "asteria.sqlite3");
  const accountVault = path.join(profile, "credentials", "radio-accounts.enc");
  expect(existsSync(database)).toBe(true);
  expect(existsSync(accountVault)).toBe(true);
  expect(readFileSync(database).includes(Buffer.from("robust isolated production acceptance"))).toBe(false);
});
