# Unified linting, templates, telemetry, and management-plane plan

- Plan ID: `lappe-unified-system-v1`
- Status: `draft_for_review`
- Date: 2026-07-17
- Companion docs:
  - `docs/plans/2026-07-17-unified-system-sketches.md` (wireframes and diagrams for every piece)
  - `docs/plans/2026-07-17-pm-plugin-linter-migration-plan.md` (file-by-file migration lane)
  - `docs/plans/2026-07-17-harness-logs-analysis-charter.md` (new project charter)
  - `docs/plans/2026-07-17-management-plane-design.md` (local management app design + name candidates)
  - `docs/plans/2026-07-17-unified-system-plan.json` (machine-readable twin)

## Objective

Bring the scattered linting, template, documentation-sanitization, and telemetry work into one system with a single shared engine, then close the loop: local shift-left enforcement → structured logs → committed reports → a logs-analysis project → upstream hooks and agent guidance that prevent the same defects earlier. Add a local management plane (GUI) over scripts, automations, CI configs, security jobs, and harness state. Position the whole package as the next increment of the main program line.

## Program-line placement (the "V8" question — resolved to v7)

The main program line lives in the harness repo:

- Active pointer: `harness/docs/plans/ACTIVE-PLAN.pointer` → `docs/program/v5/PROGRAM.md`
- `docs/program/v6/` — 30+ work orders (WO-G/S/M/T/C/P/X)
- `docs/plans/v7/` — newest staged package (PROGRAM.md, WP-00..WP-09, documentation-control-plane, harness-feature-architecture)

**Resolved (DEC-101):** the harness program owners have declared there is **no v8; v7 is the latest line**, and the orchestrator is Opus (harness PR #485, 2026-07-17). This plan is therefore *not* a separate v8 increment. Its workstreams are cross-repo contributions that feed v7, with program-line placement owned by the harness v7 package rather than asserted from the linter side. Nothing here contradicts v7 — WS-D/E/F/G below are the concrete build-out of v7's `documentation-control-plane-execution-plan.md` and `harness-feature-architecture.md` (Projects/Work/Environments/Models/Assurance/Insights). The harness-side lane (PR-108) adds a coordination pointer *outside* `docs/plans/v7/` (that package is audit-locked by `validate_package.py`), so the v7 owners incorporate these workstreams on their own cadence.

## Execution status (2026-07-17)

Landed on `master` via PR #10 (squash `91b16ad`) and the telemetry follow-on:

- **WS-B (property-based templates) — DONE.** `packages/core/src/templates/` (`resolveTemplate`, `resolveNamedTemplate`, `renderTemplate`): global base → one property-scoped child via the existing scope matcher, per-scope toggles that drop and unpin attributes, clock-free render. `templates:` + `automations:` blocks in `linter.yaml` with strict loader validation, draft-07 JSON schema, and commented scaffold entries.
- **WS-C (CLI shift-left surface) — DONE (first slice).** `lappe-linter template list|show|apply|check` (new notes scaffolded; existing notes previewed, never overwritten — DEC-104) and `run <name>|--list` (honors automation failure modes: open never blocks, closed surfaces exit 1). `report`/`export` commands remain to be built.
- **WS-A (PM-plugin migration) — linter side DONE.** The template subsystem is the reconciled port target; the PM-plugin source deletion + provider stub (PR-103) is a separate cross-repo lane on its own branch.
- **WS-D (telemetry) — lappe-linter side DONE.** Core telemetry contract `packages/core/src/telemetry/` (`template-event` v1, `run-summary` v1, `toJsonl`); CLI emits these under `--json` from `template`/`run`, with a `--trigger` label for hooks/CI. The `session-data` ingest of `template_events`/`lint_runs` (harness/session-data side of PR-106) is pending.

Decisions:

- **DEC-101 — RESOLVED:** no v8; align to harness **v7** (Opus-orchestrated) per harness PR #485. Placement owned by the v7 package.
- **DEC-107 (carries DEC-005) — open:** `--json` FileReport stays output-version 1 for hook/CI compatibility; the new telemetry events carry their own per-event `v`, so no breaking bump was needed. Linter-styles CLI parity still to decide.

Test posture: full suite green (1822 tests, 125 suites); CLI↔plugin byte parity intact; strict `tsc` on core; plugin bundles.

## What this consolidates (evidence inventory)

| Thread | Where it is today |
|---|---|
| Lappe lint engine + CLI | `lappe-linter/packages/core` (@lappe-linter/core, pure, ~1,779 tests), `packages/cli` (binary `lappe-linter`: check/fix/explain/init/new-rule, `--json` output-version 1, `--changed`) |
| Property templates & scopes | `packages/core/src/note-types/` (six starter types, key order, required keys, value enums), `packages/core/src/scope/` (folder/path/frontmatter/tag/age/date/backlink/alias matchers), `linter.yaml` defaults+profiles inheritance, `src/lappe/config-service.ts pushDefaultsToProfiles()` |
| Linter code that drifted into the PM plugin | `product-management-plugin/src/linter-config-core.ts` (603 ln, pure), `src/linter-config-view.ts` (355 ln), 2 test files, `styles.css` L381-492 — landed via PRs #29/#31 |
| Lint telemetry (F07) | `lappe-linter/scripts/harness/` — `lint-on-write.sh` (fail-open PostToolUse spool), `pre-commit-lint.sh` (fail-closed gate), `ingest-lint-spool.py` (spool → SQLite `lint_events`), `docs/harness/install.md` HC-1..HC-6 |
| Session/evidence store | `harness/src/harness/sessions/` (ingestor → `session-data/sessions.db`, 8 event types), `daily/rollup.py` + `ledger.py` (cost), JSONL spool conventions |
| Markdown governance in harness | `scripts/ci/check-governance.py`, doc-drift checks, pointer plumbing, `rules/common/*` + `rules/harness/*`, staged `docs/plans/v7/2026-07-16-documentation-control-plane-execution-plan.md` |
| Script indexing | `harness/scripts/script-index.md`, `config/scripts.md` + `src/harness/scripts/registry.py`, `docs/documentation/scripts/index.md`, `scripts/gen/gen-*.py` generators |
| CI/security/fleet | `code-analysis.yml` (ruff/gitleaks/Trivy), scaffolded per-project CI templates, `gen-fleet-health.py` (drift-detected), `security/security-audit.sh` + weekly LaunchAgent, `security/policy/policy.yaml` |
| Management-plane vision | `harness/docs/plans/v7/harness-feature-architecture.md`, `harness-dashboards` repo (cross-project dashboard/rollup code) |
| Product management | `product-management-plugin` intent spine + cost read-model; `packages/core/src/providers/` is its sanctioned integration path (HC-5/F08) |

## Design principles

1. **One engine, many surfaces.** `@lappe-linter/core` is the single shared component. Obsidian plugin, CLI, hooks, CI, containers, and the management plane all call the same core. Nothing Obsidian-specific ever enters core (already enforced by `no-obsidian.test.ts`).
2. **Shift left, log everything, fail predictably.** Authoring-time hooks are fail-open; commit/CI gates are fail-closed. Every run — wherever it fires — emits the same structured events.
3. **Read models, not new databases.** Reports and the management plane are projections over artifacts that already exist (linter.yaml, JSONL spools, sessions.db, registries). No always-on daemons.
4. **Obsidian-native theming with portable tokens.** All UI uses `--ll-*` design tokens that resolve to Obsidian CSS variables inside the vault and to system-font fallbacks everywhere else (see sketches doc, section 11).
5. **The flywheel is the product.** Telemetry exists to change upstream behavior: worst-offender rules become agent guidance, hook tightening, and template fixes — measurably reducing late-stage CI failures.

## Target architecture (summary — full diagrams in sketches doc)

```
                      ┌────────────────────────────────────────────┐
                      │            @lappe-linter/core              │
                      │  rules · scopes · note-types · templates   │
                      │  automations · code-checks · providers     │
                      └──────┬───────┬─────────┬─────────┬─────────┘
             ┌───────────────┘       │         │         └───────────────┐
     Obsidian plugin           lappe-linter   hooks/CI              provider API
     (left-nav settings,          CLI        (on-write, pre-commit,  (PM plugin
      preview, reports)                       scheduled, pipeline)    contributes
             │                    │              │                    note-types/rules)
             └───────────┬────────┴──────┬───────┘
                         ▼               ▼
                lint/template events  run summaries      (JSONL, output-version 2)
                         │
                         ▼
          spool → session-data drop path → sessions.db (lint_events, template_events)
                         │
            ┌────────────┴──────────────┐
            ▼                           ▼
   committed rollup reports       harness-logs-analysis project
   (per-repo .md/.json in CI)     (findings, insights, automation candidates)
            │                           │
            └────────────┬──────────────┘
                         ▼
              management plane app + upstream hooks
              (rule digests → CLAUDE.md/agent prompts → fewer errors)
```

## Workstreams

### WS-A — Migrate linter code out of product-management-plugin (owner: both repos)

The PM plugin's own pipeline plan already states it "does not own Markdown lint execution." Extract `linter-config-core.ts` / `linter-config-view.ts` (+ tests + `.pm-config-*` CSS) back to lappe-linter, **reconciling rather than copying** — the tested `@lappe-linter/core` stays authoritative; only the capabilities core lacks are ported (template body rendering, pinned override keys, the split-preview UX). The PM plugin then integrates the linter the sanctioned way: shipping a provider (`packages/core/src/providers/`, HC-5). Full file-by-file lane: `2026-07-17-pm-plugin-linter-migration-plan.md`.

Exit: PM plugin has zero linter source; lappe-linter owns the split preview; PM provider stub registered; both test suites green.

### WS-B — Complete the property-based template system (owner: lappe-linter)

Three layers, matching the intended model:

1. **Global base template** — one template everybody inherits: `linter.yaml` `defaults` + a new `templates.global` block (frontmatter seed, key order, body scaffold, **pinned keys** = template-owned attributes).
2. **Property-based templates** — scoped sub-templates that inherit from global and can **toggle attributes off** per scope. Scopes are the existing matchers: folder/path, YAML frontmatter properties, tags, project, domain/category/sub-category, age, dates, backlinks, aliases. Per-option override vs reset-to-inherited semantics already exist (profiles + `pushDefaultsToProfiles`); this extends them to template bodies and pinned keys.
3. **Rules & automations bindings** — under each template/scope, declare *when* and *how* linting runs: a new `automations:` section in `linter.yaml` (trigger: on-write | on-rename | pre-commit | schedule | ci | manual; action: check | fix; failure mode: open | closed; logging destination). Sketch and YAML shape in sketches doc, section 3.

Exit: `templates:` + `automations:` schema landed in `packages/core/src/config/schema.ts` with loader/serializer/scaffold support; template application is preview-first with an explicit apply contract (no silent rewrites of existing notes); parity in CLI and plugin.

### WS-C — CLI as the shift-left execution surface (owner: lappe-linter)

The `lappe-linter` binary already exists; extend it:

- `lappe-linter template list | show <name> | apply <paths> [--dry-run] | check <paths>`
- `lappe-linter report [--repo <name>] [--since <date>] [--json|--md]` — renders the usage/lint report locally
- `lappe-linter export [--out <dir>]` — writes the secure telemetry bundle (WS-F input)
- `lappe-linter run <automation-name>` — fires a named automation from `linter.yaml` (this is what launchd/cron/CI call)

Deployed to containers via the existing single-file bundle (`dist/lappe-linter-bundle.cjs`, ~30 ms cold start) and registered through the harness pointer registry (HC-1/HC-6, `LAPPE_LINTER_BIN`).

Exit: commands shipped with tests + docs; container profile updated; `--json` bumped to output-version 2 (below) with 1 kept as a compatibility mode.

### WS-D — Telemetry v2: log every run, ingest into CI, commit the evidence (owner: lappe-linter + session-data)

Extends the F07 pipeline that already works (spool → `ingest-lint-spool.py` → SQLite):

- **lint-event v2**: adds `run_id`, `trigger`, `repo`, `action`, `duration_ms` to the existing per-violation shape.
- **template-event v1** (new): `{ts, run_id, trigger, repo, path, template, scope_matched, keys_applied[], toggles_overridden[], mode: preview|apply}` — this is what powers "which repos use which templates how often."
- **run-summary v1** (new): one line per run — files scanned/changed, violations, fixes, templates invoked, exit code.
- Ingestion: same spool + idempotent content-hash import, two new tables (`template_events`, `lint_runs`) beside `lint_events` in `sessions.db`.
- **CI ingestion + commit**: a scheduled/CI job runs the rollup and commits per-repo report artifacts (`docs/reports/lint/YYYY-MM-DD.{md,json}`) so the evidence lands in GitHub, exactly as requested. CI also uploads its own run's JSONL as a build artifact so container/CI runs join local runs in session-data via the existing F3.5.1 append-only drop path.

Exit: schemas versioned in `packages/core`; ingest + rollup shipped; first committed report exists; CI red/green unaffected by telemetry failures (fail-open capture, fail-closed gates unchanged).

### WS-E — Reports & management surface in the plugin (owner: lappe-linter)

A polished, left-nav "Reports" surface inside the linter (and the same data via CLI/management plane): template invocations by repo/template, lint runs over time, top rules fired, most-linted folders/files, coverage (what is actually being linted vs. not). All Obsidian-theme-native. Wireframes: sketches doc, sections 4–6. The "worst offenders" panel links directly to the upstream-hook action (WS-F output): "promote to agent guidance."

Exit: Reports view shipped reading the local rollup JSON; zero network calls; renders correctly under default + community themes (uses only `--ll-*` tokens).

### WS-F — harness-logs-analysis project (owner: new project; charter attached)

A dedicated project whose only job is analyzing the accumulated logs: cost hot spots and local maxima, rule-violation concentrations, automation candidates, template adoption, and recommendations that feed upstream (hook tightening, rule digests into CLAUDE.md via the existing `gen-rules-digest.py` pattern, template fixes). Cross-container data arrives via the session-data contract that already exists (containers append to the drop path; host launchd is the sole `sessions.db` writer). v1 export is deliberately simple/manual: `lappe-linter export` produces a checksummed, secret-scrubbed JSONL bundle dropped on the existing path. Full charter: `2026-07-17-harness-logs-analysis-charter.md`.

Exit: repo/project scaffolded via `harness project init`; first findings report produced from real data; recommendations round-trip into at least one upstream hook change.

### WS-G — Management plane app (owner: new surface; design attached)

The "AWS console for your local dev machine": a local-first, read-model-first GUI over scripts & automations (indexed, sortable by project/folder/language/metadata, with schedules and version history), harness configuration toggles, per-project dependencies + vulnerability/threat scan status, CI configs with cross-project drift diffing, policies, environments, security job scheduling, and the Insights feed from WS-F. It solves cognitive load: one place to see what exists, what's scheduled, what drifted, and what it costs. Full design incl. information architecture, data sources (all existing registries), phasing (v0 local web read-only → v1 actions → v2 packaged app), and **name candidates**: `2026-07-17-management-plane-design.md`.

Exit (v0): app runs locally, renders Scripts, Projects/CI-drift, Security, and Insights panels from existing artifacts with zero write actions.

### WS-H — Code-comment linting / agent header contract (owner: lappe-linter core, future lane)

Extends the existing `code-checks/` subsystem (bounded regex over fenced code — generalize to source files) with a **file-header contract**: what goes at the top of every script (purpose, inputs/outputs, run instructions, schedule expectations, and LLM-agent directives in a fixed, machine-readable syntax). This is dual-audience by design: humans get discoverability; agents get deterministic intake instructions. The same header metadata feeds the management plane's script index. Contract sketch: sketches doc, section 12.

Exit: header schema ratified (DEC below); `lappe-linter check` can enforce presence/shape on opted-in paths; script-index generator consumes it.

### WS-I — Product-management capability alignment (owner: product-management-plugin)

Review outcome: the PM plugin is on the right track as the intent surface — keep the 10-level spine, work-item-id joins, and the read-only cost view. Two corrections: (1) WS-A removes the linter code it should never have hosted; (2) capabilities must be surface-agnostic — each capability (intent CRUD, RICE, roadmap, cost view) is exposed through Obsidian *and* `pm-vault` CLI *and* (read-only) the management plane, with the capability map documented so new surfaces bind to the same core functions. The provider API keeps the linter/PM boundary clean while letting PM contribute note-types and report-only rules.

Exit: capability map doc in PM repo; provider stub shipping note-types; no cross-plugin source imports (unchanged invariant).

## PR sequence

| PR | Repo | Title | Depends on | Exit |
|---|---|---|---|---|
| PR-101 | lappe-linter | docs: adopt unified system plan (this package) | none | **MERGED** (#10, `91b16ad`) |
| PR-102 | lappe-linter | feat(core): template subsystem (body + pinned-key + toggles) | PR-101 | **MERGED** (#10) |
| PR-103 | product-management-plugin | refactor: remove linter code; ship provider stub | PR-102 | next lane (own branch) |
| PR-104 | lappe-linter | feat(config): `templates:` + `automations:` schema, loader, scaffold | PR-102 | **MERGED** (#10) |
| PR-105 | lappe-linter | feat(cli): template/run commands (report/export to follow) | PR-104 | **MERGED** (#10) |
| PR-106a | lappe-linter | feat(telemetry): core event contract + CLI `--json` emission | PR-105 | **in review** (this branch) |
| PR-106b | session-data | feat(telemetry): ingest template_events + lint_runs; committed rollups | PR-106a | pending |
| PR-107 | lappe-linter | feat(ui): Reports left-nav surface | PR-106 | pending |
| PR-108 | harness | docs: v7-aligned cross-repo coordination pointer (outside the audit-locked v7 package) referencing this plan | PR-101 | coordination comment posted on harness #485 |
| PR-109 | new repo | chore: scaffold harness-logs-analysis via `harness project init` | PR-106 | pending |
| PR-110 | harness-dashboards or new | feat: management plane v0 (read-only panels) | PR-106 | validated |

## Decisions needed

- DEC-101: **Resolved** — no v8; align to harness v7 (Opus-orchestrated) per harness PR #485. Placement owned by the v7 package.
- DEC-102: Management plane name (candidates + recommendation in the design doc) and host repo (`harness-dashboards` vs. fresh repo).
- DEC-103: Management plane runtime — recommendation is local web app (Next.js/localhost) first, packaged as Electron/Tauri later; confirm.
- DEC-104: Template apply contract for existing notes (preview-only today): which keys a template may rewrite on apply, and whether apply ever runs from automations or only interactively/CLI.
- DEC-105: Agent header contract syntax (comment block shape per language family) before WS-H implementation.
- DEC-106: Export bundle format/signing for cross-container joins (v1: sha256 checksums inside the bundle; decide whether to add signing now or at v2 automation).
- DEC-107: Carries forward DEC-005 (linter-styles CLI parity) — must be resolved by PR-105.

## Risks

- The PM plugin's preview engine overlaps the tested core; porting instead of reconciling would fork rule semantics. Mitigation: PR-102 ports only capabilities core lacks; parity tests are the gate.
- Telemetry expansion could blur the fail-open/fail-closed split. Mitigation: capture is always fail-open; only pre-commit/CI gates fail closed; tested in `scripts/harness/tests/run.sh`.
- The management plane could drift into a second source of truth. Mitigation: v0 is strictly read-model; every panel names its canonical source artifact.
- Session-data single-writer contract must not be violated by new producers. Mitigation: all new events go through the existing spool/drop path; no direct `sessions.db` writers added.
- Plan sprawl: this package touches 5 repos. Mitigation: each PR lane is single-repo except PR-106; PR-108 is the only cross-program doc change.

## Verification & acceptance

- Every workstream lists an explicit exit above; PR lanes carry the tests.
- The flywheel is demonstrated end-to-end at least once before v8 closes: a rule with high violation counts in the report → promoted to agent guidance/hook → measured reduction in that rule's violations in the next rollup period.
- Acceptance artifact: a filled `docs/verification/` record per shipped lane, following the existing acceptance-record pattern.

## Review checklist (for Kevin)

1. Program placement: v8 increment vs. v7 work packets (DEC-101)?
2. Approve migration direction & provider replacement (WS-A) — any PM-plugin behavior you want preserved verbatim?
3. Template model: does the 3-layer global → property-scoped → rules/automations shape match your intent (sketches §3)?
4. Reports: is the sketched report (sketches §6) the "polished" surface you want first?
5. Management plane: pick a name (design doc §8) and confirm v0 scope.
6. Export: OK to start manual (`lappe-linter export`) on the existing session-data drop path?
