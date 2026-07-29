import { describe, expect, it } from "vitest";
import { CloneRepositorySchema, OnboardingSchema, ProjectUpdateSchema } from "../electron/contracts";

describe("project repository contract", () => {
  it("requires a local repository path before project creation", () => {
    expect(OnboardingSchema.shape.repositoryPath.safeParse("").success).toBe(false);
    expect(OnboardingSchema.shape.repositoryPath.safeParse("/workspace/project").success).toBe(true);
  });

  it("allows an existing project to bind a validated repository path", () => {
    const result = ProjectUpdateSchema.safeParse({
      projectId: "project_existing",
      runId: "run_existing",
      expectedVersion: 1,
      idempotencyKey: "repository_123456789",
      patch: {
        repository: "owner/project",
        repositoryPath: "/workspace/project"
      }
    });
    expect(result.success).toBe(true);
  });

  it("requires an owner-selected storage folder before RaDio clones", () => {
    const base = {
      cloneUrl: "https://github.com/example/project.git",
      projectName: "Example",
      idempotencyKey: "clone_123456789"
    };
    expect(CloneRepositorySchema.safeParse(base).success).toBe(false);
    expect(CloneRepositorySchema.safeParse({ ...base, storagePath: "/workspace/projects" }).success).toBe(true);
  });
});
