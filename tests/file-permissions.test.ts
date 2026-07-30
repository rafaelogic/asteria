import { chmodSync, lstatSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensurePrivateDirectory, hardenPrivateTree, prepareApplicationData } from "../electron/file-permissions";
import { readFileSync } from "node:fs";

const roots: string[] = [];
const mode = (target: string) => lstatSync(target).mode & 0o777;

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("application-owned file permissions", () => {
  it("sets an owner-only process umask before application setup", () => {
    expect(readFileSync("electron/main.ts", "utf8")).toContain("process.umask(0o077)");
    expect(readFileSync("scripts/install-user-release.mjs", "utf8")).toContain("process.umask(0o077)");
  });

  it("repairs existing sensitive paths independently of inherited modes", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "asteria-permissions-"));
    roots.push(root);
    mkdirSync(path.join(root, "vault"), { mode: 0o777 });
    writeFileSync(path.join(root, "vault", "database-key.bin"), "encrypted", { mode: 0o666 });
    writeFileSync(path.join(root, "asteria.sqlite3"), "ciphertext", { mode: 0o666 });
    chmodSync(root, 0o755);

    prepareApplicationData(root);

    expect(mode(root)).toBe(0o700);
    expect(mode(path.join(root, "vault"))).toBe(0o700);
    expect(mode(path.join(root, "vault", "database-key.bin"))).toBe(0o600);
    expect(mode(path.join(root, "asteria.sqlite3"))).toBe(0o600);
  });

  it("preserves owner execute permission while removing group and world access", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "asteria-permissions-"));
    roots.push(root);
    const executable = path.join(root, "provider");
    writeFileSync(executable, "#!/bin/sh\n", { mode: 0o755 });

    hardenPrivateTree(root);

    expect(mode(executable)).toBe(0o700);
  });

  it("does not follow symlinks out of an application-owned tree", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "asteria-permissions-"));
    const external = mkdtempSync(path.join(os.tmpdir(), "asteria-external-"));
    roots.push(root, external);
    chmodSync(external, 0o755);
    symlinkSync(external, path.join(root, "external"));

    ensurePrivateDirectory(root);
    hardenPrivateTree(root);

    expect(mode(external)).toBe(0o755);
  });
});
