import { createHash } from "node:crypto";
import type { ProviderId, RiskClassification, SpecialistRole } from "../../src/types.js";

export type ModelTier = "fast" | "balanced" | "frontier";
export type DirectiveModule = "radio" | "stars";

export interface DirectiveFrontmatter {
  id: string;
  version: string;
  module: DirectiveModule;
  subject: "radio" | SpecialistRole;
  priority: number;
  coordinates: string[];
  modelTier: ModelTier;
  requiredCapabilities: string[];
}

export interface Directive {
  metadata: DirectiveFrontmatter;
  body: string;
  source: string;
}

export interface PromptManifest {
  directiveIds: string[];
  directiveVersions: Record<string, string>;
  requestedTier: ModelTier;
  resolvedProvider: ProviderId;
  resolvedModel: string;
  routingReason: string;
  fallbackHistory: string[];
  promptDigest: string;
}

export interface ComposedPrompt {
  prompt: string;
  manifest: PromptManifest;
}

const tiers = new Set<ModelTier>(["fast", "balanced", "frontier"]);
const subjects = new Set<string>([
  "radio", "planner", "product_designer", "ui_designer", "architect", "frontend", "backend",
  "database", "devops", "integrator", "reviewer", "qa", "security", "accessibility", "performance",
]);
const requiredHeadings = ["Identity", "Responsibilities", "Boundaries", "Operating method", "Handoff"];

function scalar(value: string) {
  const trimmed = value.trim();
  if (/^\[.*\]$/.test(trimmed)) return trimmed.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/^["']|["']$/g, "");
}

export function parseDirective(source: string, sourceName = "inline"): Directive {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/);
  if (!match) throw new Error(`Directive ${sourceName} requires YAML frontmatter.`);
  const record: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`Directive ${sourceName} has invalid frontmatter.`);
    record[line.slice(0, separator).trim()] = scalar(line.slice(separator + 1));
  }
  for (const field of ["id", "version", "module", "subject", "priority", "coordinates", "modelTier", "requiredCapabilities"]) {
    if (record[field] === undefined) throw new Error(`Directive ${sourceName} requires ${field}.`);
  }
  if (record.module !== "radio" && record.module !== "stars") throw new Error(`Directive ${sourceName} has an invalid module.`);
  if (!subjects.has(String(record.subject)) || (record.module === "stars" && record.subject === "radio") || (record.module === "radio" && record.subject !== "radio")) {
    throw new Error(`Directive ${sourceName} has an invalid subject.`);
  }
  if (!tiers.has(record.modelTier as ModelTier)) throw new Error(`Directive ${sourceName} has an unknown model tier.`);
  if (!Number.isInteger(record.priority) || (record.priority as number) < 0) throw new Error(`Directive ${sourceName} has an invalid priority.`);
  if (!Array.isArray(record.coordinates) || !Array.isArray(record.requiredCapabilities)) throw new Error(`Directive ${sourceName} requires array metadata.`);
  if (!/^\d+\.\d+\.\d+$/.test(String(record.version))) throw new Error(`Directive ${sourceName} requires a semantic version.`);
  const body = match[2].trim();
  for (const heading of requiredHeadings) {
    if (!new RegExp(`^## ${heading}$`, "m").test(body)) throw new Error(`Directive ${sourceName} requires a ${heading} section.`);
  }
  const identity = body.match(/^## Identity\r?\n([\s\S]*?)(?=^## )/m)?.[1] ?? "";
  if (record.module === "stars" && /\b(?:You are RaDio|I am (?:Codex|Claude))\b/i.test(identity)) {
    throw new Error(`Directive ${sourceName} contains an unsafe identity claim.`);
  }
  if (record.module === "radio" && /\bI am (?:Codex|Claude|a provider|an agent)\b/i.test(identity)) {
    throw new Error(`Directive ${sourceName} contains an unsafe RaDio identity claim.`);
  }
  return { metadata: record as unknown as DirectiveFrontmatter, body, source: sourceName };
}

export class DirectiveRegistry {
  private readonly directives: Directive[];

  constructor(sources: Array<{ source: string; name: string }>) {
    const parsed = sources.map((item) => parseDirective(item.source, item.name));
    const keys = new Set<string>();
    for (const directive of parsed) {
      const key = directive.metadata.id;
      if (keys.has(key)) throw new Error(`Duplicate directive ${key}.`);
      keys.add(key);
    }
    for (let index = 0; index < parsed.length; index += 1) {
      for (const other of parsed.slice(index + 1)) {
        const current = parsed[index];
        if (current.metadata.module !== other.metadata.module
          || current.metadata.subject !== other.metadata.subject
          || current.metadata.priority !== other.metadata.priority) continue;
        const overlaps = current.metadata.coordinates.includes("*")
          || other.metadata.coordinates.includes("*")
          || current.metadata.coordinates.some((coordinate) => other.metadata.coordinates.includes(coordinate));
        if (overlaps) throw new Error(`Conflicting directive priority for ${current.metadata.id} and ${other.metadata.id}.`);
      }
    }
    this.directives = parsed.sort((left, right) => left.metadata.priority - right.metadata.priority || left.metadata.id.localeCompare(right.metadata.id));
  }

  list(module?: DirectiveModule) {
    return Object.freeze(this.directives.filter((item) => !module || item.metadata.module === module));
  }

  forSubject(module: DirectiveModule, subject: DirectiveFrontmatter["subject"], coordinate?: string) {
    return this.directives.filter((directive) =>
      directive.metadata.module === module
      && directive.metadata.subject === subject
      && (!coordinate || directive.metadata.coordinates.includes("*") || directive.metadata.coordinates.includes(coordinate))
    );
  }
}

const rank: Record<ModelTier, number> = { fast: 0, balanced: 1, frontier: 2 };
const roleDefaults: Partial<Record<SpecialistRole, ModelTier>> = {
  planner: "frontier", architect: "frontier", security: "frontier", reviewer: "frontier",
  product_designer: "balanced", ui_designer: "balanced", frontend: "balanced", backend: "balanced",
  database: "balanced", devops: "balanced", integrator: "balanced", qa: "balanced",
  accessibility: "balanced", performance: "balanced",
};

export class ModelRouter {
  constructor(
    private readonly models: Partial<Record<ProviderId, Partial<Record<ModelTier, string>>>> = {},
    private readonly options: { allowUnverifiedDefault?: boolean } = {}
  ) {}

  route(input: {
    provider: ProviderId;
    role?: SpecialistRole;
    risk?: RiskClassification;
    explicitTier?: ModelTier;
    task?: "synthesis" | "planning" | "implementation" | "repair" | "verification" | "classification" | "release";
    repeatedFailures?: number;
    evidenceConflict?: boolean;
  }) {
    let requestedTier = input.explicitTier
      ?? (input.task === "classification" ? "fast" : input.task === "synthesis" || input.task === "planning" || input.task === "release" ? "frontier" : input.role ? roleDefaults[input.role] ?? "balanced" : "balanced");
    const reasons = [`${input.explicitTier ? "directive" : input.task ? "task" : "role"} default: ${requestedTier}`];
    const requiresEscalation = input.risk === "destructive" || input.task === "release" || input.role === "security" || input.role === "architect"
      || (input.repeatedFailures ?? 0) >= 2 || input.evidenceConflict;
    if (requiresEscalation) {
      if (requestedTier !== "frontier") reasons.push("escalated for risk, repeated failure, or conflicting evidence");
      requestedTier = "frontier";
    }
    const protectedDecision = requestedTier === "frontier";
    const configuredModel = this.models[input.provider]?.[requestedTier];
    const resolvedModel = configuredModel ?? "provider-configured-default";
    const fallbackHistory = configuredModel ? [] : [`No explicit ${input.provider} ${requestedTier} model mapping; provider-configured default selected.`];
    const blockedReason = protectedDecision && !configuredModel && !this.options.allowUnverifiedDefault
      ? `A configured ${requestedTier} model is required for this protected decision.`
      : undefined;
    return {
      requestedTier,
      resolvedProvider: input.provider,
      resolvedModel,
      routingReason: reasons.join("; "),
      fallbackHistory,
      protectedDecision,
      blockedReason,
    };
  }
}

export class PromptComposer {
  compose(input: {
    safety: Directive;
    identity: Directive;
    directives?: Directive[];
    skills?: string;
    context: string;
    assignment: string;
    route: ReturnType<ModelRouter["route"]>;
  }): ComposedPrompt {
    const ordered = [input.safety, input.identity, ...(input.directives ?? [])]
      .filter((item, index, values) => values.findIndex((candidate) => candidate.metadata.id === item.metadata.id) === index)
      .sort((left, right) => left.metadata.priority - right.metadata.priority || left.metadata.id.localeCompare(right.metadata.id));
    const prompt = [
      ...ordered.map((item) => item.body),
      input.skills?.trim() ? `## Activated skills\n${input.skills.trim()}` : "",
      `## Orbit context and continuity\n${input.context.trim()}`,
      `## Current assignment and evidence\n${input.assignment.trim()}`,
    ].filter(Boolean).join("\n\n");
    return {
      prompt,
      manifest: {
        directiveIds: ordered.map((item) => item.metadata.id),
        directiveVersions: Object.fromEntries(ordered.map((item) => [item.metadata.id, item.metadata.version])),
        requestedTier: input.route.requestedTier,
        resolvedProvider: input.route.resolvedProvider,
        resolvedModel: input.route.resolvedModel,
        routingReason: input.route.routingReason,
        fallbackHistory: input.route.fallbackHistory,
        promptDigest: createHash("sha256").update(prompt).digest("hex"),
      },
    };
  }
}
