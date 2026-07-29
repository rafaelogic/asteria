import { describe, expect, it } from "vitest";
import { projects } from "../src/data";
import { recommendedRoles, transitionWorkflow } from "../src/workflow";

describe("production workflow", () => {
  it("activates data and UI specialists from product intent", () => {
    const roles = recommendedRoles("Build an accessible analytics dashboard backed by a database migration");
    expect(roles).toContain("product_designer");
    expect(roles).toContain("accessibility");
    expect(roles).toContain("database");
    expect(roles).toContain("security");
  });

  it("blocks an unchanged review loop after three attempts", () => {
    let project = {
      ...projects[0],
      workflow: projects[0].workflow.map((step) => ({ ...step, status: step.id === "review" ? "active" as const : step.status, attempt: step.id === "review" ? 1 : step.attempt }))
    };
    project = transitionWorkflow(project, "fail_review");
    expect(project.runStatus).toBe("active");
    project = transitionWorkflow(project, "fail_review");
    expect(project.runStatus).toBe("blocked");
    expect(project.currentAction.title).toMatch(/Human direction/);
  });

  it("keeps a transition scoped to the selected project", () => {
    const second = structuredClone(projects[1]);
    transitionWorkflow(projects[0], "complete");
    expect(projects[1]).toEqual(second);
  });
});
