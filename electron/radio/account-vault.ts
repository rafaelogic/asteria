import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProviderAccountProfile, ProviderId, SpecialistRole } from "../../src/types.js";

type Encrypt = (value: string) => Buffer;
type Decrypt = (value: Buffer) => string;

export class RaDioAccountVault {
  private profiles: ProviderAccountProfile[] = [];
  private readonly file: string;

  constructor(private userData: string, private encrypt: Encrypt, private decrypt: Decrypt) {
    this.file = path.join(userData, "credentials", "radio-accounts.enc");
  }

  async load() {
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    try {
      this.profiles = JSON.parse(this.decrypt(await readFile(this.file))) as ProviderAccountProfile[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.profiles = [];
    }
    return this.list();
  }

  list() {
    return this.profiles.map((profile) => ({ ...profile }));
  }

  get(profileId: string) {
    return this.profiles.find((profile) => profile.id === profileId);
  }

  async ensureDefaults(providers: ProviderId[]) {
    for (const provider of providers) {
      if (!this.profiles.some((profile) => profile.provider === provider)) {
        const profile = await this.add(provider, provider === "codex" ? "Codex primary" : "Claude primary", false);
        try {
          await cp(path.join(this.userData, "provider-profiles", provider, provider), path.join(this.userData, "provider-accounts", profile.id, provider), { recursive: true, force: false });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    }
    return this.list();
  }

  async add(provider: ProviderId, nickname: string, authenticated = false) {
    const profile: ProviderAccountProfile = {
      id: randomUUID(), nickname, provider, enabled: true, order: this.profiles.length,
      authenticated, capabilities: ["structured-stream", "cancellation", "isolated-home", "tool-events"],
      health: "healthy", usage: { source: "unavailable", capturedAt: new Date().toISOString() },
      activeSessions: 0, concurrencyLimit: 1, failureRate: 0, allowedProjectIds: [], allowedRoles: [] as SpecialistRole[]
    };
    this.profiles.push(profile);
    await this.persist();
    return profile;
  }

  async update(profileId: string, patch: Partial<Pick<ProviderAccountProfile, "nickname" | "enabled" | "order" | "allowedProjectIds" | "usage" | "health" | "authenticated">>) {
    const index = this.profiles.findIndex((profile) => profile.id === profileId);
    if (index < 0) throw new Error("Provider account profile not found.");
    this.profiles[index] = { ...this.profiles[index], ...patch };
    await this.persist();
    return this.profiles[index];
  }

  async remove(profileId: string) {
    this.profiles = this.profiles.filter((profile) => profile.id !== profileId);
    await this.persist();
  }

  private async persist() {
    await writeFile(this.file, this.encrypt(JSON.stringify(this.profiles)), { mode: 0o600 });
  }
}
