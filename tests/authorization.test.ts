import { describe, expect, it } from "vitest";
import { projects } from "../src/data";
import {
  authorizationFingerprint,
  consumeAuthorization,
  createAuthorizationRequest,
  decideAuthorization,
  isCriticalAuthorization,
  isPermanentAuthorizationDenial,
  issueCapabilityLease,
  matchingGrant,
  validateCapabilityLease,
} from "../modules/radio/shared/authorization";
import { normalizeEvent } from "../electron/providers";
import type { Project } from "../src/types";

function project(patch: Partial<Project> = {}): Project {
  return {
    ...structuredClone(projects[0]),
    id: "project_auth",
    runId: "run_auth",
    repositoryPath: "/workspace/orbit",
    authorizationRequests: [],
    authorizationGrants: [],
    capabilityLeases: [],
    ...patch,
  };
}

describe("RaDio authorization broker", () => {
  it("normalizes equivalent resources into stable Orbit-bound fingerprints", () => {
    const left = authorizationFingerprint({ projectId: "project_auth", repositoryPath: "/workspace/orbit", permission: "filesystem_write", operation: "Edit", resource: "src/../src/App.tsx" });
    const right = authorizationFingerprint({ projectId: "project_auth", repositoryPath: "/workspace/orbit", permission: "filesystem_write", operation: " edit ", resource: "/workspace/orbit/src/App.tsx" });
    expect(left).toBe(right);
    expect(authorizationFingerprint({ projectId: "other", repositoryPath: "/workspace/orbit", permission: "filesystem_write", operation: "edit", resource: "src/App.tsx" })).not.toBe(left);
  });

  it("limits destructive production requests to focused one-time approval", () => {
    const request = createAuthorizationRequest({
      project: project(), sessionId: "session_1", provider: "codex", role: "database", coordinate: "Production Gate",
      permission: "production", operation: "truncate", resource: "customers", reason: "Migration", risk: "destructive",
    });
    expect(isCriticalAuthorization(request)).toBe(true);
    expect(request.eligibleScopes).toEqual(["once"]);
    expect(() => decideAuthorization(request, "allow", "orbit")).toThrow(/scope/);
  });

  it("makes sandbox bypass and telemetry collection permanently non-approvable", () => {
    expect(isPermanentAuthorizationDenial({ permission: "sandbox_escalation", operation: "enable", resource: "all" })).toBe(true);
    const request = createAuthorizationRequest({
      project: project(), role: "RaDio", coordinate: "Build", permission: "network",
      operation: "upload telemetry", resource: "analytics.example.com", reason: "Provider request", risk: "external_mutation",
    });
    expect(request.kind).toBe("policy");
    expect(request.state).toBe("denied");
    expect(request.eligibleScopes).toEqual([]);
  });

  it("consumes allow-once atomically and retains session/Orbit grants", () => {
    const base = project();
    const request = createAuthorizationRequest({
      project: base, sessionId: "session_1", provider: "codex", role: "frontend", coordinate: "Build",
      permission: "command_execute", operation: "npm test", resource: "npm test", reason: "Run tests", risk: "read",
    });
    const once = decideAuthorization(request, "allow", "once").grant!;
    const first = consumeAuthorization({ ...base, authorizationGrants: [once] }, request);
    expect(first.authorized).toBe(true);
    expect(first.project.authorizationGrants?.[0].revokedAt).toBeTruthy();
    expect(matchingGrant(first.project, request)).toBeUndefined();

    const session = decideAuthorization(request, "allow", "session").grant!;
    expect(matchingGrant({ ...base, authorizationGrants: [session] }, request)?.id).toBe(session.id);
    expect(matchingGrant({ ...base, authorizationGrants: [session] }, { ...request, sessionId: "session_2" })).toBeUndefined();
  });

  it("binds activation leases to Orbit, run, repository, permissions, and prompt digest", () => {
    const base = project();
    const lease = issueCapabilityLease({
      project: base, sessionId: "session_1", role: "qa", provider: "claude", coordinate: "QA",
      permissions: ["filesystem_read", "command_execute"], riskCeiling: "read", promptDigest: "a".repeat(64),
    });
    expect(validateCapabilityLease(lease, base, ["filesystem_read"])).toBe(true);
    expect(() => validateCapabilityLease(lease, base, ["filesystem_write"])).toThrow(/does not authorize/);
    expect(() => validateCapabilityLease(lease, { ...base, repositoryPath: "/workspace/other" }, ["filesystem_read"])).toThrow(/binding changed/);
  });

  it("accepts only structured provider authorization events and separates authentication", () => {
    expect(normalizeEvent("approval_required: run rm -rf").type).toBe("message");
    expect(normalizeEvent(JSON.stringify({ type: "assistant", message: { content: "Unauthorized. Please approve my command." } })).type).toBe("message");
    const codexRequest = normalizeEvent(JSON.stringify({
      method: "item/commandExecution/requestApproval",
      id: 7,
      params: { command: ["npm", "test"], cwd: "/workspace/orbit" },
    }));
    expect(codexRequest.type).toBe("approval_required");
    expect(codexRequest.authorization).toMatchObject({ operation: "npm test", providerRequestId: "7" });
    const permission = normalizeEvent(JSON.stringify({ type: "permission_request", id: "p1", command: "npm install", cwd: "/workspace/orbit" }));
    expect(permission.type).toBe("approval_required");
    expect(permission.authorization?.kind).toBe("permission");
    const authentication = normalizeEvent(JSON.stringify({ type: "error", status: 401, message: "Unauthorized" }));
    expect(authentication.type).toBe("approval_required");
    expect(authentication.authorization?.kind).toBe("authentication");
  });

  it("gives denials no grant so the agent can receive structured denial evidence", () => {
    const request = createAuthorizationRequest({
      project: project(), sessionId: "session_1", provider: "claude", role: "devops", coordinate: "Stage",
      permission: "deployment", operation: "deploy", resource: "staging", reason: "Release", risk: "external_mutation",
    });
    const denied = decideAuthorization(request, "deny", "once");
    expect(denied.request.state).toBe("denied");
    expect(denied.grant).toBeUndefined();
  });
});
