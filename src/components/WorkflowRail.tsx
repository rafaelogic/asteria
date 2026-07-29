import {
  ArrowRightIcon,
  CheckIcon,
  CodeIcon,
  FlaskIcon,
  LightbulbIcon,
  ListChecksIcon,
  RocketLaunchIcon,
  SparkleIcon,
  UsersThreeIcon
} from "@phosphor-icons/react";
import type { SpecialistRole, WorkflowStep } from "../types";

const icons: Record<SpecialistRole, typeof CodeIcon> = {
  planner: LightbulbIcon, product_designer: SparkleIcon, ui_designer: SparkleIcon, architect: ListChecksIcon,
  frontend: CodeIcon, backend: CodeIcon, database: CodeIcon, devops: RocketLaunchIcon, integrator: UsersThreeIcon,
  reviewer: UsersThreeIcon, qa: FlaskIcon, security: ListChecksIcon, accessibility: UsersThreeIcon, performance: RocketLaunchIcon
};

export function WorkflowRail({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="workflow-rail" aria-label="Workflow progress" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(92px, 1fr))` }}>
      {steps.map((step, index) => {
        const Icon = icons[step.role] ?? SparkleIcon;
        return (
          <div className={`workflow-node ${step.status}`} key={step.id}>
            <span className={`node-icon ${step.status === "active" ? "electric-orbit" : ""}`}>
              {step.status === "complete" ? <CheckIcon weight="bold" /> : <Icon weight="duotone" />}
            </span>
            <strong>{step.name}</strong>
            <small>{step.status === "active" ? "In progress" : step.status}</small>
            {index < steps.length - 1 ? <ArrowRightIcon className="rail-arrow" /> : null}
          </div>
        );
      })}
    </div>
  );
}
