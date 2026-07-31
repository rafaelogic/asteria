import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import type {
  AuthorizationGrant, AuthorizationPermission, AuthorizationRequest, AuthorizationScope, CapabilityLease,
  Project, ProviderId, RiskClassification, SpecialistRole,
} from "../../../src/types.js";

const permanentDenials = [
  /telemetry/i,
  /analytics/i,
  /dangerously[-_ ]?bypass/i,
  /bypassPermissions/i,
];
const leaseSigningKey = randomBytes(32);

export function isPermanentAuthorizationDenial(input: Pick<AuthorizationRequest, "permission" | "operation" | "resource">) {
  return input.permission === "sandbox_escalation"
    || permanentDenials.some((pattern) => pattern.test(`${input.operation} ${input.resource}`));
}

function canonicalResource(permission: AuthorizationPermission, resource: string, repositoryPath?: string) {
  const trimmed = resource.trim().replaceAll("\0", "");
  if (permission === "filesystem_read" || permission === "filesystem_write") {
    const absolute = path.resolve(repositoryPath ?? process.cwd(), trimmed);
    return process.platform === "win32" ? absolute.toLowerCase() : absolute;
  }
  if (permission === "network") {
    try { return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname.toLowerCase(); }
    catch { return trimmed.toLowerCase(); }
  }
  return trimmed.replace(/\s+/g, " ").slice(0, 4096);
}

export function authorizationFingerprint(input: {
  projectId: string;
  repositoryPath?: string;
  permission: AuthorizationPermission;
  operation: string;
  resource: string;
}) {
  const payload = [
    input.projectId,
    input.repositoryPath ? path.resolve(input.repositoryPath) : "unbound",
    input.permission,
    input.operation.trim().toLowerCase(),
    canonicalResource(input.permission, input.resource, input.repositoryPath),
  ].join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

export function isCriticalAuthorization(input: Pick<AuthorizationRequest, "risk" | "permission" | "operation" | "resource">) {
  return input.risk === "destructive"
    || input.permission === "production";
}

export function createAuthorizationRequest(input: {
  project: Project;
  sessionId?: string;
  provider?: ProviderId;
  role: SpecialistRole | "RaDio";
  coordinate: string;
  permission: AuthorizationPermission;
  operation: string;
  resource: string;
  reason: string;
  risk: RiskClassification;
  kind?: "permission" | "authentication" | "policy" | "capability";
}): AuthorizationRequest {
  const now = new Date().toISOString();
  const fingerprint = authorizationFingerprint({
    projectId: input.project.id,
    repositoryPath: input.project.repositoryPath,
    permission: input.permission,
    operation: input.operation,
    resource: input.resource,
  });
  const policyDenied = isPermanentAuthorizationDenial({ ...input });
  const critical = isCriticalAuthorization({ ...input });
  return {
    id: randomUUID(),
    projectId: input.project.id,
    runId: input.project.runId,
    sessionId: input.sessionId,
    provider: input.provider,
    role: input.role,
    coordinate: input.coordinate,
    kind: policyDenied ? "policy" : input.kind ?? "permission",
    permission: input.permission,
    operation: input.operation,
    resource: canonicalResource(input.permission, input.resource, input.project.repositoryPath),
    reason: input.reason,
    risk: input.risk,
    fingerprint,
    state: policyDenied ? "denied" : "pending",
    decision: policyDenied ? "deny" : undefined,
    eligibleScopes: policyDenied ? [] : critical ? ["once"] : ["once", "session", "orbit"],
    decisionToken: randomUUID(),
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}

export function matchingGrant(project: Project, request: AuthorizationRequest, now = Date.now()) {
  return (project.authorizationGrants ?? []).find((grant) =>
    !grant.revokedAt
    && grant.fingerprint === request.fingerprint
    && grant.projectId === request.projectId
    && (!grant.expiresAt || Date.parse(grant.expiresAt) > now)
    && (grant.scope !== "session" || grant.sessionId === request.sessionId)
    && grant.decision === "allow"
  );
}

export function decideAuthorization(
  request: AuthorizationRequest,
  decision: "allow" | "deny",
  scope: AuthorizationScope,
  now = new Date().toISOString()
): { request: AuthorizationRequest; grant?: AuthorizationGrant } {
  if (request.state !== "pending") throw new Error("Authorization request was already decided.");
  if (request.expiresAt && Date.parse(request.expiresAt) < Date.parse(now)) throw new Error("Authorization request expired.");
  if (!request.eligibleScopes.includes(scope)) throw new Error("This authorization scope is not allowed for the requested operation.");
  const updated = { ...request, state: decision === "allow" ? "granted" as const : "denied" as const, decision, scope, updatedAt: now };
  if (decision === "deny") return { request: updated };
  return {
    request: updated,
    grant: {
      id: randomUUID(),
      projectId: request.projectId,
      runId: request.runId,
      sessionId: scope === "session" ? request.sessionId : undefined,
      fingerprint: request.fingerprint,
      permission: request.permission,
      operation: request.operation,
      resource: request.resource,
      decision,
      scope,
      createdAt: now,
      expiresAt: scope === "session" ? undefined : scope === "orbit" ? new Date(Date.parse(now) + 90 * 86_400_000).toISOString() : undefined,
      useCount: 0,
    },
  };
}

export function consumeAuthorization(project: Project, request: AuthorizationRequest, now = new Date().toISOString()) {
  const grant = matchingGrant(project, request, Date.parse(now));
  if (!grant) return { authorized: false as const, project };
  const grants = (project.authorizationGrants ?? []).map((item) => item.id !== grant.id ? item : {
    ...item,
    useCount: item.useCount + 1,
    lastUsedAt: now,
    consumedAt: item.scope === "once" ? now : item.consumedAt,
    revokedAt: item.scope === "once" ? now : item.revokedAt,
  });
  return { authorized: true as const, grant, project: { ...project, authorizationGrants: grants } };
}

export function issueCapabilityLease(input: {
  project: Project;
  sessionId: string;
  role: SpecialistRole | "RaDio";
  provider: ProviderId;
  coordinate: string;
  permissions: AuthorizationPermission[];
  riskCeiling: RiskClassification;
  promptDigest: string;
  skillDigests?: string[];
}): CapabilityLease {
  const issuedAt = new Date().toISOString();
  const lease = {
    id: randomUUID(),
    nonce: randomUUID(),
    projectId: input.project.id,
    runId: input.project.runId,
    sessionId: input.sessionId,
    role: input.role,
    provider: input.provider,
    coordinate: input.coordinate,
    repositoryPath: input.project.repositoryPath,
    permissions: [...new Set(input.permissions)],
    riskCeiling: input.riskCeiling,
    promptDigest: input.promptDigest,
    skillDigests: [...new Set(input.skillDigests ?? [])],
    issuedAt,
    expiresAt: new Date(Date.parse(issuedAt) + 8 * 60 * 60_000).toISOString(),
  };
  const digest = createHmac("sha256", leaseSigningKey).update(JSON.stringify(lease)).digest("hex");
  return { ...lease, digest };
}

export function validateCapabilityLease(lease: CapabilityLease, project: Project, requested: AuthorizationPermission[]) {
  const { digest, ...unsigned } = lease;
  const expected = createHmac("sha256", leaseSigningKey).update(JSON.stringify(unsigned)).digest();
  const supplied = Buffer.from(digest, "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error("Capability lease signature is invalid.");
  if (lease.projectId !== project.id || lease.runId !== project.runId) throw new Error("Capability lease is outside the active Orbit/run.");
  if (Date.parse(lease.expiresAt) <= Date.now()) throw new Error("Capability lease expired.");
  if (lease.repositoryPath && project.repositoryPath && path.resolve(lease.repositoryPath) !== path.resolve(project.repositoryPath)) {
    throw new Error("Capability lease repository binding changed.");
  }
  const missing = requested.filter((permission) => !lease.permissions.includes(permission));
  if (missing.length) throw new Error(`Capability lease does not authorize: ${missing.join(", ")}.`);
  return true;
}
