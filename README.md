# Asteria

Asteria is a privacy-hardened Electron control plane for autonomous software delivery. It runs installed Claude Code or OpenAI Codex CLIs inside app-owned configuration homes and presents Starpaths, approvals, Star Map tickets, Constellations, artifacts, and network decisions in one focused desktop interface.

> Asteria is currently pre-release software. Review its safety controls and use staging environments before granting Ascendant permissions.

## Product language

- Each project is an **Orbit**.
- **RaDio** is the isolated autonomous coordinator.
- Specialist agents are **Stars**, and review panels are **Constellations**.
- The delivery workflow is a **Starpath**, with stages represented as **Coordinates**.
- Ideas arrive as **Signals**, work is tracked on the **Star Map**, and results appear as **Observations**.
- Provider failover uses **Relays** and resumes from redacted **Waypoints**.
- **Guided** mode gates external mutations; **Ascendant** mode can operate approved staging resources without routine intervention.

## Privacy model

- `npm run audit:privacy` checks Asteria's source and dependencies for remote analytics SDKs and hard-coded upload paths.
- Renderer requests use a deny-by-default Electron network policy.
- Provider processes receive app-owned `HOME`, `USERPROFILE`, XDG, `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, and temporary paths.
- Project data uses a SQLCipher-compatible SQLite database whose key is encrypted by Electron `safeStorage`.

The local privacy report is generated at `runtime/privacy-audit.json`.

## Development

```bash
npm install
npm run dev:electron
```

The browser-renderable UI can be started separately with:

```bash
npm run dev -- --host 0.0.0.0 --port 4173
```

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Node.js 22.12 or newer is required. Copy `.env.example` to `.env` only when configuring the optional GitHub Device Flow client identifier; never commit the resulting `.env` file.

The selected design reference, implementation captures, combined comparison, and final report live under `design/` and `design-qa.md`.

## Packaging

`npm run package` builds installers through electron-builder. Production signing and notarization credentials must be supplied by the release environment.

The release workflow packages macOS, Windows, and Linux on their native runners. Configure `ASTERIA_GITHUB_CLIENT_ID` as a repository variable and signing/notarization values as repository secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`). No application credential is committed to the repository.

## Repository

Source, issues, and releases: [github.com/rafaelogic/asteria](https://github.com/rafaelogic/asteria)
