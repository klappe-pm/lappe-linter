# Management plane — design (WS-G)

- Plan ID: `management-plane-design-v1`
- Status: `draft_for_review`
- Parent: `docs/plans/2026-07-17-unified-system-plan.md`
- Wireframes: `docs/plans/2026-07-17-unified-system-sketches.md` §10

## Problem

Scripts, automations, schedules, CI configs, policies, environments, and security jobs exist across many repos and a harness — but knowing what exists, where it lives, when it runs, and whether it drifted requires remembering and searching. That cognitive load causes redundant scripts, forgotten schedules, unnoticed drift, and lost work. The fix is one surface: the AWS-console/command-center equivalent for the local development system.

## Product definition

A local-first GUI that **represents** the harness configuration and fleet state — a management plane over what already exists, not a new system of record. It answers, on one screen each:

- What scripts and automations do I have? (indexed, sortable by project, folder, language, metadata, description)
- What's scheduled, what ran, what failed?
- What does each project depend on, and what do the vulnerability/threat scans say?
- Which CI configs drifted from the baseline, and is that OK?
- What policies and environments are in force?
- What is all of this costing, and what should I automate next? (Insights, from harness-logs-analysis)

## Principles

1. **Read-model first.** v0 has zero write actions. Every panel names its canonical source artifact; the app is a projection. This mirrors the harness feature-architecture doc's read-model rule and prevents a second source of truth.
2. **Nothing runs all the time.** No daemons; the app reads artifacts on open/refresh. Scheduled things stay owned by launchd/cron/CI — the plane *shows* schedules, and (v1+) can fire a job on demand or point it at a folder.
3. **Same navigation, same theme system.** Left-hand hierarchical nav identical in structure to the plugin's; styled with the `--ll-*` tokens so it matches the Obsidian aesthetic while remaining fully restylable (sketches §11).
4. **Scripts are first-class citizens.** The index is the flagship panel, built from the existing registries plus the agent header contract (WS-H) for metadata.

## Information architecture (left nav)

```
Home                    — counters, today's runs, alerts
Scripts & automations   — the index; by project / by language / schedules
Projects                — per-repo: dependencies, CI & drift, policies
Environments            — container/env registry, fleet health
Security                — scan jobs, schedules, last results, policy baselines
Harness config          — the toggle view of what the harness does
Insights                — findings/recommendations from harness-logs-analysis
Settings                — paths, refresh, theme tokens
```

## Data sources (all existing)

| Panel | Canonical sources |
|---|---|
| Scripts & automations | `harness/scripts/script-index.md`, `config/scripts.md` + `src/harness/scripts/registry.py` semantics, `docs/documentation/scripts/index.md`, header contracts (WS-H), git history for version trail, `linter.yaml automations:` blocks per repo |
| Schedules | `security/*.plist`, launchd/cron state, automation triggers |
| Projects: dependencies & vulns | lockfiles, Trivy/gitleaks CI outputs, `code-analysis.yml` results |
| CI & drift | scaffolded templates (`src/harness/projects/templates/`) as baseline vs. per-repo workflows; `gen-fleet-health.py` drift flags; `check-access-configs.py` |
| Policies | `security/policy/policy.yaml` + rendered baselines |
| Environments | `environments/REGISTRY.md`, `registry.json`, `fleet-alerts.json` |
| Harness config | pointer registry, `config/*`, flags/experiments |
| Insights | `harness-logs-analysis/findings/*.json`, committed lint reports |

## Script versioning

Scripts already live in git — the plane doesn't reinvent version control; it surfaces it: per-script version trail (commits touching the file), a monotonic display version derived from the header contract (`lappe-header v1` carries no version; the trail is git), and "changed since last run" badges. A script edit that changes behavior shows up as a diff link, which is exactly the input the linting project can consume (script linting = WS-H enforcement on headers + the code-analysis seeds on content).

## Phasing

- **v0 (read-only, local web)**: Next.js (or equivalent) app served on localhost reading the artifacts above from disk. TypeScript aligns with the product-metrics backlog's named vehicle and with `harness-dashboards` as the cross-project dashboard/rollup code repo — recommendation: build it there (DEC-102 covers repo choice).
- **v1 (safe actions)**: run-on-demand (invokes existing CLIs: `lappe-linter run …`, `harness …`), point-a-script-at-a-folder, record-drift-exception, open-fix-PR links. Every action shells out to an existing, already-authorized command — the plane never gets its own privileges.
- **v2 (packaged app)**: wrap as a Mac app (Electron or Tauri; decide at v2 — Tauri is lighter, Electron more familiar) with the same read-model core. Later: the CLI management surface ("naming functions") once the GUI stabilizes the model.

## Non-goals

- Not a scheduler, not a CI system, not a secrets holder, not a new database.
- Never writes to `sessions.db`, registries, or repos directly (v1 actions go through existing CLIs only).
- Not a replacement for the Obsidian surfaces — it's the operator view; the vault stays the authoring view.

## 8. Naming (decision needed — DEC-102)

Constraints: it's a real product (not "whatever-component manager"), should sit comfortably beside `harness`, `lappe-linter`, `pm-vault`, and shouldn't collide badly in search.

| Candidate | Rationale | Collision check |
|---|---|---|
| **Bridge** (recommended) | The ship's bridge is literally the command center from which the vessel (fleet/containers/harness) is conned; short, dignified, pairs as `harness-bridge`; nautical family fits "fleet health" language already in the harness | Generic word, but `harness-bridge` / "Lappe Bridge" is distinctive enough |
| **Conn** | "Taking the conn" = holding control authority; very short; memorable | Obscure to non-nautical users; near "con" |
| **Harbormaster** | Oversees every vessel in the harbor — exactly the fleet/container metaphor | Collides with Phabricator's old Harbormaster CI tool |
| **Switchboard** | Plainly descriptive: one board, every switch | Least distinctive; several existing tools |

Recommendation: **Bridge** (repo `harness-bridge` or inside `harness-dashboards`), with "Conn" as the fallback if you want something more unusual. Final call is yours — flagging it now because v0 needs a name before its repo/scaffold is created.

## Acceptance (v0)

- Launches locally, renders Home, Scripts, CI & drift, Security, and Insights panels from real artifacts.
- Every panel displays its canonical-source path.
- No write paths exist in v0 code.
- Theme: renders acceptably with default tokens and when `--ll-*` tokens are overridden (proves restylability).
