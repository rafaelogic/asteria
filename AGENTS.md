# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

Each project owns an independent Starpath. Project switching must also switch the objective, workflow stages, active specialist, provider, timeline, approvals, Kanban cards, discussions, artifacts, and run state; never present one global workflow as if it were shared across projects.

Asteria telemetry is local-only and enabled with visible controls. Full replay is redacted before encrypted persistence, defaults to 30-day retention and a 5 GB quota, and must never introduce a collector endpoint, remote analytics SDK, installation identifier, or background upload path.

The active project objective must retain clear top and bottom spacing below the run header; never overlap or clip it against the Starpath rail.

GitHub authentication is an application-level isolated profile stored in the encrypted credential vault. Repository, branch, selected file, and displayed code context remain project-scoped and must switch with the active project.

During GitHub device authorization, always show the one-time code in an in-app modal in addition to copying it to the clipboard. Adaptive team onboarding must distinguish required roles from selectable specialists, and selections must configure the newly created project's workflow.

The active workflow animation belongs on the circular stage icon. Keep the surrounding workflow-node container static.

Returning users land in their most recently active existing project. Starpath preparation appears only for first run or after the user explicitly selects New project.

GitHub authentication is reusable across projects from the app-owned credential vault; new-project setup offers the connected account first and keeps “connect a different account” explicit.

Use recognizable provider company marks for Codex and Claude. Asteria’s installed app icon uses the cyan/violet constellation ring with a centered capital A.

Keep the installed Asteria icon in operating-system surfaces; use the lightweight product mark inside the app rather than repeating the installer artwork in navigation.

All projects is a first-class navigation screen. Starting a new project must preserve the previous project and expose a persistent return action from every onboarding step; project and screen changes participate in back/forward history.

Prompt entry includes a local writing-improvement action before workflow submission. Code and evidence surfaces use maintained syntax-highlighting and rich-format preview libraries, Kanban cards expose current agent ownership and operational metadata, motion language extends consistently across screens with reduced-motion support, and Help includes a visual process map.

The constellation-inspired product language is durable: the app is Asteria, each project is an Orbit, the isolated autonomous core is RaDio, supporting agents are Stars, agent panels and discussions are Constellations, the workflow is Starpath, stages are Coordinates, the ideas inbox is Signals, the board is Star Map, reports are Observations, the dashboard is Observatory, provider and account switching is Relay, checkpoints are Waypoints, autonomous mode is Guided, and full autonomous mode is Ascendant. Do not prefix these terms with Asteria or Orbit unless project ownership must be explicit.

RaDio is Asteria’s isolated autonomous core. Orbits choose Guided or Ascendant during onboarding; Ascendant is staging-first, direct pushes to main/master remain prohibited, and merge-plus-production authority is separately configurable. RaDio uses encrypted application-owned Codex and Claude account pools, switches at an authoritative 5% remaining-usage threshold through normalized redacted Waypoints, never guesses unavailable usage, and always requires focused approval before destructive live production-data operations.

RaDio provider sessions must expose the same locally available provider skills and companion developer tools as the owner’s Codex or Claude environment, while preserving Asteria’s repository, network, deployment, credential, and approval boundaries.

Every repository change must bump Asteria’s version in both `package.json` and `package-lock.json`. Follow semantic versioning: use a patch bump by default, a minor bump for backward-compatible features, and a major bump for breaking changes.
