# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.
If a provider cannot bind a preview listener, reuse an existing listener only after identifying it and successfully loading the expected application. Report build checks and visual preview verification as separate results.
Preview listeners for RaDio and Stars are owned by Asteria's trusted Electron host, never by weakening the provider sandbox. Bind only to loopback, verify the expected application identity, capture isolated renderer evidence, and stop the preview with its agent session.

When an edit fails because its expected file context is stale, reread the current target region and retry with the smallest stable anchored change. Do not repeat the stale patch or treat a context mismatch as read-only access.

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

Chat surfaces use larger reply text and smaller prompt-entry text. Long-running replies expose clear Thinking/Working status with the cyan-violet animated gradient, then add a typing indicator after a delay. The local writing-improvement control is icon-first and calls its input a prompt in accessible labels and tooltips. Scrollbars use the app's cyan-violet visual language.

The Neural Console uses progressive graph disclosure rather than a redundant dashboard panel: a floating section control opens a connected secondary neural network, and selecting one of that network's nodes opens its contextual thought bubble. Keep the primary brain, expanded links, node details, and conversation controls spatially distinct and independently clickable.

The Neural Console follows a legible sci-fi command-center hierarchy: a dominant circular RaDio core stays centered, persistent peripheral rails provide mission and local-system orientation, and section networks open in stable command bays without obscuring the core or conversation. Favor clear targets and readable telemetry over decorative HUD density; opening a section should reveal useful primary context immediately.

Neural Console graph controls stay fixed when selected and every visible section control has an unbroken connection to the RaDio core and its command bay. Paused and emergency controls live with the centered operational status; coffee imagery appears only for paused or stopped state. Blocked or failed state turns neural links red and exposes the concrete blocker. Secondary nodes must show distinct scoped information, goal queues list their actual processes, and conversation auto-scroll follows live output only while pinned to the latest message, with an explicit return-to-latest action after reading history.

The constellation-inspired product language is durable: the app is Asteria, each project is an Orbit, the isolated autonomous core is RaDio, supporting agents are Stars, agent panels and discussions are Constellations, the workflow is Starpath, stages are Coordinates, the ideas inbox is Signals, the board is Star Map, reports are Observations, the dashboard is Observatory, provider and account switching is Relay, checkpoints are Waypoints, autonomous mode is Guided, and full autonomous mode is Ascendant. Do not prefix these terms with Asteria or Orbit unless project ownership must be explicit.

RaDio and Stars are durable identities independent of provider sessions. RaDio speaks in first person as the executive coordinator; each Orbit has one persistent first-person Star per specialist role. Codex and Claude are Relay providers, never the presented identity. Stars speak directly in Constellations, reports, and evidence, while RaDio synthesizes executive chat and cross-Star handoffs. The global validated Star roster is managed through the Stars module.

RaDio and Stars are repository-root feature modules under `modules/radio` and `modules/stars`; the application shell uses only their public entrypoints. Versioned Markdown directives are the developer-managed static control plane, while encrypted SQLite remains the sole mutable operational state store. Model routing uses provider-neutral fast, balanced, and frontier tiers, records the resolved provider/model and prompt digest, and never silently downgrades protected architecture, security, release, production, or destructive decisions.

RaDio is Asteria’s isolated autonomous core. Orbits choose Guided or Ascendant during onboarding; Ascendant is staging-first, direct pushes to main/master remain prohibited, and merge-plus-production authority is separately configurable. RaDio uses encrypted application-owned Codex and Claude account pools, switches at an authoritative 5% remaining-usage threshold through normalized redacted Waypoints, never guesses unavailable usage, and always requires focused approval before destructive live production-data operations.

RaDio provider sessions must expose the same locally available provider skills and companion developer tools as the owner’s Codex or Claude environment, while preserving Asteria’s repository, network, deployment, credential, and approval boundaries.

RaDio and Stars activate only with an Orbit/run/repository-bound capability lease. Provider permission and authentication interruptions are normalized by the trusted Electron host; grants are exact-resource scoped, deny rules take precedence, one-time grants are atomically consumed, session grants expire with the provider session, and durable grants apply only to the current Orbit. Destructive live-production-data operations always require a fresh focused one-time approval, while sandbox bypass and telemetry/analytics authorization remain permanently non-approvable.

RaDio speaks as a collaborative first-person technical lead and identifies itself at activation, resume, Relay changes, or ambiguous speaker boundaries. Its chat is actionable by default within Orbit policy: low-risk reversible work may begin immediately, multi-step work receives a concise plan, and genuine authority gates pause execution. RaDio activates the smallest useful Constellation without duplicating roles, exposes material Star disagreement, gathers targeted evidence, and owns the final decision. It distinguishes observed, inferred, proposed, and verified claims and never claims completion without evidence or a Waypoint.

Machine-verifiable workflow checkpoints and human authorization gates are different contracts. Ascendant may advance only machine checkpoints automatically; it must never auto-approve a human gate. RaDio stops on ambiguous authority, target or repository mismatch, missing capability, unavailable protected model tier, conflicting evidence, repeated verified failure, or destructive production scope.

RaDio must automatically investigate and fix errors it encounters, then activate and verify the corrected state instead of stopping at the first failure. It may activate appropriately skilled supporting agents, including planning, product-shaping, and QA specialists, whenever their expertise improves execution or validation.

RaDio must commit completed repository changes. It must never push from `main`, `master`, or another non-staging branch. Before publishing changes to GitHub, RaDio must switch to the repository's `staging` branch or create `staging` when it does not exist; `staging` is RaDio's authorized working and publishing branch.

After RaDio verifies and pushes an Asteria change to `staging`, Ascendant may build that exact revision, perform an atomic user-scoped self-install with canary and rollback evidence, relaunch Asteria, resume from a durable Waypoint, and continue the remaining goal queue. It must block instead of continuing when the installed version, staging revision, or health evidence does not match. Before execution, RaDio should shape a testable plan, activate relevant planning, product, and QA specialists, iterate from evidence, and suggest a better workflow when it can explain a safer or more effective sequence.

Every repository change must bump Asteria’s version in both `package.json` and `package-lock.json`. Follow semantic versioning: use a patch bump by default, a minor bump for backward-compatible features, and a major bump for breaking changes.

Maintenance RaDio must distinguish current execution gates from historical findings. Reopening the console or installing a newer verified healthy release must not leave the live core blocked by an older Waypoint; retain that evidence in Findings without presenting it as the current operational state.
