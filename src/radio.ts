import type {
  AccountPoolPolicy, ProviderAccountProfile, RaDioSettings, RiskClassification, SpecialistRole
} from "./types.js";

export const DEFAULT_RADIO_SETTINGS: RaDioSettings = {
  mode: "autonomous",
  enabled: true,
  stagingBranch: "radio/staging",
  mergeProductionEnabled: false,
  maxRepairAttempts: 3,
  dailyScout: true,
  emergencyStopped: false,
  accountPool: { enabled: false, thresholdPercent: 5, crossProvider: true, accountIds: [] }
};

export const RADIO_GOVERNING_PROMPT = `You are RaDio, Asteria's project-scoped autonomous coordinator.
Prefer reversible actions and verified checkpoints. Inspect every target and environment before acting.
Never delete, truncate, destructively migrate, or irreversibly mutate live production data.
Use staging first. Never push directly to main or master. Never claim checks passed without evidence.
Respect project, credential, account, network, budget, and environment boundaries.
Stop when a target is ambiguous, a safety check fails, or authority is insufficient.
Do not reveal secrets, hidden reasoning, raw credentials, or unredacted provider output.`;

export function accountCanRun(profile: ProviderAccountProfile, projectId: string, role: SpecialistRole, requiredCapabilities: string[]) {
  const cooldown = profile.cooldownUntil && Date.parse(profile.cooldownUntil) > Date.now();
  const authorizedProject = profile.allowedProjectIds.length === 0 || profile.allowedProjectIds.includes(projectId);
  const authorizedRole = profile.allowedRoles.length === 0 || profile.allowedRoles.includes(role);
  const hasCapabilities = requiredCapabilities.every((capability) => profile.capabilities.includes(capability));
  const capacity = profile.activeSessions < profile.concurrencyLimit;
  const remaining = profile.usage.remainingPercent;
  return profile.enabled && profile.authenticated && !cooldown && profile.health !== "unavailable"
    && profile.health !== "switching" && authorizedProject && authorizedRole && hasCapabilities && capacity
    && (remaining === undefined || remaining > 5);
}

export function selectRaDioAccount(
  profiles: ProviderAccountProfile[],
  policy: AccountPoolPolicy,
  projectId: string,
  role: SpecialistRole,
  requiredCapabilities: string[],
  currentProvider?: ProviderAccountProfile["provider"]
) {
  const pinned = policy.rolePins?.[role];
  return profiles
    .filter((profile) => policy.accountIds.includes(profile.id))
    .filter((profile) => !pinned || profile.id === pinned)
    .filter((profile) => policy.crossProvider || !currentProvider || profile.provider === currentProvider)
    .filter((profile) => accountCanRun(profile, projectId, role, requiredCapabilities))
    .sort((left, right) => {
      const capacity = (right.usage.remainingPercent ?? -1) - (left.usage.remainingPercent ?? -1);
      return capacity || left.failureRate - right.failureRate || left.order - right.order;
    })[0];
}

export function radioPolicyDecision(input: {
  settings: RaDioSettings;
  risk: RiskClassification;
  operation: string;
  branch?: string;
  environment?: string;
}) {
  if (!input.settings.enabled || input.settings.emergencyStopped) return { decision: "deny" as const, reason: "RaDio is paused or emergency-stopped." };
  if (/delete|truncate|drop|destructive|erase/i.test(input.operation) && input.environment === "production") {
    return { decision: "approval" as const, reason: "Live production data destruction always requires focused human approval." };
  }
  if (/push/i.test(input.operation) && /^(main|master)$/i.test(input.branch ?? "")) {
    return { decision: "deny" as const, reason: "Direct pushes to main or master are prohibited." };
  }
  if (input.environment === "production" && !input.settings.mergeProductionEnabled) {
    return { decision: "approval" as const, reason: "Production authority is not enabled for this project." };
  }
  if (input.settings.mode === "autonomous" && input.risk !== "read" && input.risk !== "workspace_write") {
    return { decision: "approval" as const, reason: "Guided mode gates external mutations." };
  }
  return { decision: "allow" as const, reason: "Operation is inside the configured RaDio authority." };
}
