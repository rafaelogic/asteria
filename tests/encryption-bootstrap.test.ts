import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("clean-install encryption contract", () => {
  const main = readFileSync("electron/main.ts", "utf8");
  const storage = readFileSync("electron/storage.ts", "utf8");
  const accountVault = readFileSync("modules/radio/electron/account-vault.ts", "utf8");
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as { build: { linux: { executableArgs?: string[] } } };

  it("fails closed except for Asteria's explicit, visibly degraded Linux basic backend", () => {
    expect(main).toContain("safeStorage.isEncryptionAvailable()");
    expect(main).toContain('process.platform === "linux" && app.commandLine.getSwitchValue("password-store") === "basic"');
    expect(main).toContain("safeStorage.setUsePlainTextEncryption(true)");
    expect(main).toContain("degradedCredentialStorage = true");
    expect(main).toContain("Linux keyring unavailable");
    expect(main).toContain("will not create an unencrypted application profile");
    expect(manifest.build.linux.executableArgs ?? []).not.toContain("--password-store=basic");
  });

  it("generates and wraps a unique SQLCipher key on first launch", () => {
    expect(storage).toContain("randomBytes(32)");
    expect(storage).toContain('safeStorage.encryptString(key)');
    expect(storage).toContain("db.pragma(`key = \"x'${key}'\"`)");
    expect(storage).toContain("db.pragma(\"cipher = 'sqlcipher'\")");
    expect(storage).toContain('db.pragma("secure_delete = ON")');
  });

  it("encrypts RaDio account profiles outside project workspaces", () => {
    expect(accountVault).toContain('"credentials", "radio-accounts.enc"');
    expect(accountVault).toContain("this.encrypt(JSON.stringify(this.profiles))");
    expect(accountVault).toContain("{ mode: 0o600 }");
  });
});
