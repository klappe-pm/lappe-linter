# Cross-project Obsidian plugin plan of record

- Plan ID: `cross-project-plugin-plan-of-record`
- Status: `draft`

## Objective

Reconcile every existing Lappe Linter and Product Management plan into one coordination contract with separate repository-owned execution lanes, accurate statuses, and no duplicated linter or pipeline ownership.

## Non-goals

- Merge the two repositories or make either plugin depend on the other at source level.
- Delete historical plans, backlog directories, or user-owned dirty work.
- Re-implement the already-tested Lappe core or Product Management consumption core.
- Treat a plan status as proof that the corresponding Obsidian behavior is shipped.
- Resolve the external session-data producer or capture decisions without the required local data evidence.

## Assumptions

- lappe-linter owns Markdown lint execution, linter.yaml, formatting rules, scopes, and Obsidian lint commands.
- product-management-plugin owns product intent, product notes, dashboards, indexes, and read-only cost consumption.
- The Product Management ACTIVE-PLAN.pointer remains a repository-local pointer; this file is the cross-project coordination plan.
- The existing Lappe and Product Management pure-core tests are reusable and do not need to be replaced by this reconciliation.
- Any external producer lane begins only after its repository state, local data availability, and export contract are verified.

## Decisions needed

- DEC-001: Confirm this file is the cross-project coordination plan while each repository may retain a local plan pointer for its own implementation lane.
- DEC-002: For Lappe, decide whether linter-styles are intentionally Obsidian-only or must reach CLI parity.
- DEC-003: For Lappe, choose the final non-blocking preview workflow and complete scope autocomplete before marking the settings lane done.
- DEC-004: For Product Management pipeline, choose the final render surface and exact cost-index path without changing the read-only contract.
- DEC-005: For session-data, verify real token availability and choose the producer export path before scheduling the external producer lane.
- DEC-006: Keep optional artifact-id capture gated on the existing D-049 decision; do not fabricate attribution.

## Risks

- Marking the old Lappe DONE plan complete would cause agents to skip the actual settings-shell work.
- The Lappe current UI refactor contains a constructor mismatch and undefined unreachable reference that esbuild does not catch.
- Product pipeline work can drift if the research plan, implementation plan, and active pointer are treated as independent authorities.
- A shared Obsidian vault or copied source can make the two plugins appear integrated while their configuration and rule engines remain separate.
- The external session-data producer may be blocked by missing local reports or null token evidence.
- Manual Obsidian verification remains necessary because repository tests do not prove settings registration, reload, or active-vault artifact selection.

## PR sequence

| PR | Title | Depends on | Owner | Exit |
|---|---|---|---|---|
| `PR-001` | docs: establish one cross-project plan of record | none | integration owner | `ready_for_review` |
| `PR-002` | docs: reconcile Product Management plan authorities | PR-001 | Product Management documentation lane | `ready_for_review` |
| `PR-003` | feat: finish Lappe settings and runtime delivery | PR-001 | Lappe settings and runtime lane | `ready_for_review` |
| `PR-004` | feat: complete Product Management pipeline consumption | PR-002 | Product Management pipeline lane | `parked` |
| `PR-005` | feat: produce product-cost-index from session-data | PR-004 | session-data producer owner | `parked` |

## PR-001: docs: establish one cross-project plan of record

Make this coordination plan authoritative for cross-project status and preserve the repository-local plans as scoped historical or execution inputs.

- Repository: `/Users/kevinlappe/Projects/lappe-linter`
- Branch: `docs/cross-project-plan-of-record`
- Worktree: `/Users/kevinlappe/Projects/_worktrees/lappe-linter/cross-project-plan-of-record`
- Paths owned: `docs/plans/2026-07-10-settings-redesign-plan.md`, `docs/plans/2026-07-10-settings-tabs-redesign-plan.md`, `docs/plans/2026-07-12-lappe-linter-consolidated-delivery-plan.json`, `docs/plans/2026-07-12-lappe-linter-consolidated-delivery-plan.md`
- Merge policy: `docs_only_carve_out`

### Tasks

- Retain all source plans as evidence and mark the old Lappe DONE plan as superseded or historical when the docs lane is implemented.
- Use this file as the cross-project status map without changing repository ownership or deleting local pointers.
- Record that the Lappe backlog is empty and Product Management's backlog contains only .gitkeep.
- Keep the Lappe/product boundary explicit: ordinary Markdown may be linted, but neither plugin imports the other's source.

### Verification

#### preflight

- Read the newest passoff for each repository.
- Confirm both primary checkouts remain browse-only.

#### local

- TEST-001
- TEST-002
- git diff --check

#### ci

- Markdown and plan validation.

#### negative

- Confirm no product source paths are added to the Lappe plugin build.

### Acceptance

- Every plan artifact appears in the status roll-up.
- No plan is silently deleted or falsely marked complete.
- The two plugin ownership boundaries are explicit.
- The plan validates as an agent-executable contract.

## PR-002: docs: reconcile Product Management plan authorities

Align the local Product Management plan statuses and references with the cross-project coordination plan without changing plugin behavior.

- Repository: `/Users/kevinlappe/Projects/product-management-plugin`
- Branch: `docs/reconcile-plan-authority`
- Worktree: `/Users/kevinlappe/Projects/_worktrees/product-management-plugin/reconcile-plan-authority`
- Paths owned: `docs/plans/2026-07-03-product-intent-stack-plan.md`, `docs/plans/2026-07-04-obsidian-plugin-pipeline-integration-research-plan.md`, `docs/plans/2026-07-04-pipeline-integration-implementation-plan.md`, `docs/plans/README.md`
- Merge policy: `docs_only_carve_out`

### Tasks

- Keep the product-intent stack plan as the local active plan-of-record and preserve its INPRG scope.
- Mark the pipeline research plan as superseded input or archive it with a direct pointer to the implementation plan; preserve unresolved questions in the implementation plan or this coordination plan.
- Keep the pipeline implementation plan INPRG with its landed consumption core and explicit remaining producer/render/config/capture work.
- Add a concise boundary note that Lappe Linter is not a pipeline dependency.

### Verification

#### preflight

- Confirm origin/main is current and inspect dirty files before editing.

#### local

- TEST-004
- Markdown frontmatter validation
- git diff --check

#### ci

- Product Management build, test, version, and documentation checks.

#### negative

- Confirm ACTIVE-PLAN.pointer still resolves to the product-intent plan and no source behavior changes are included.

### Acceptance

- Product-local authority is unambiguous.
- Research and implementation plans no longer compete as equal active plans.
- The product-intent plan remains INPRG rather than being incorrectly closed.
- No plugin code changes are bundled.

## PR-003: feat: finish Lappe settings and runtime delivery

Complete the Lappe settings architecture and runtime verification using the existing tested core without shipping the current unfinished UI refactor.

- Repository: `/Users/kevinlappe/Projects/lappe-linter`
- Branch: `feat/lappe-settings-delivery`
- Worktree: `/Users/kevinlappe/Projects/_worktrees/lappe-linter/lappe-settings-delivery`
- Paths owned: `src/ui/settings.ts`, `src/ui/linter-components/tab-components/lappe-tab.ts`, `src/lappe/yaml-suggest.ts`, `src/main.ts`, `src/lappe/config-service.ts`, `packages/core/src/config`, `packages/core/src/scope`, `packages/cli/src`, `scripts/install-test-vault.sh`, `__tests__`, `packages/core/__tests__`
- Merge policy: `review_required`

### Tasks

- Start from a clean task worktree and preserve the current dirty checkout as user-owned evidence.
- Wire the existing renderers into exactly General, YAML, Headers, Body, Special formatting, Scopes, Rule order, Custom, and Debug; remove Lappe and combined Style registration.
- Fix the current LappeTab constructor mismatch and undefined unreachable code.
- Restore vault-aware YAML and scope autocomplete/multi-select controls and complete the chosen non-blocking preview workflow.
- Verify wand fallback, config reload, style-file/CLI boundaries, artifact installation, and the full Obsidian acceptance matrix.

### Verification

#### preflight

- Review current lappe-tab.ts diff before editing.
- Confirm no dirty primary files are staged.

#### local

- TEST-003
- npx tsc --noEmit with documented baseline comparison
- git diff --check

#### ci

- Full Lappe test suite, build, CSS generation, and package checks.

#### integration

- TEST-006

#### negative

- No Lappe or Style settings tab.
- Malformed linter.yaml fails closed.
- No silent wand no-op for reading view or no active file.

### Acceptance

- Requested settings tabs are visible in Obsidian.
- Core behavior, YAML persistence, scope resolution, inheritance, and rule order remain intact.
- The current type/API defects are removed.
- The exact installed artifact passes manual Obsidian verification.

## PR-004: feat: complete Product Management pipeline consumption

Finish only the Product Management side of the frozen product-cost-index contract after the remaining render-surface and path decisions are resolved.

- Repository: `/Users/kevinlappe/Projects/product-management-plugin`
- Branch: `feat/product-cost-index-consumption`
- Worktree: `/Users/kevinlappe/Projects/_worktrees/product-management-plugin/product-cost-index-consumption`
- Paths owned: `src/product-cost-index.ts`, `src/dashboard-view.ts`, `src/main.ts`, `src/settings.ts`, `docs/documentation/product-cost-index-contract.md`, `test/product-cost-index.test.ts`, `test/product-cost-view.test.ts`
- Merge policy: `parked`

### Tasks

- Do not redo the landed parser, attribution, null-safety, or cycle-guard core.
- Resolve the exact export drop path and add additive config wiring.
- Choose and implement one render surface for the read-only dataset.
- Keep session-data pricing authoritative and preserve unknown/null display behavior.
- Leave optional exact capture gated on the external D-049 decision.

### Verification

#### preflight

- Confirm the session-data contract and origin/main are current.

#### local

- TEST-004
- TEST-005
- git diff --check

#### ci

- Product Management full test/build/version gates.

#### integration

- TEST-007 after a real product-cost-index fixture is produced.

#### negative

- No telemetry writes into authored product notes.
- Null cost/token/CO2 values never render as zero.
- Ambiguous joins are excluded from summed cost.

### Acceptance

- The plugin reads the documented export without owning production of telemetry.
- One dashboard or view renders the contract with null-safe semantics.
- The product-intent plan remains independent of pipeline implementation details.

## PR-005: feat: produce product-cost-index from session-data

Produce the versioned product-cost-index export from real session-data evidence without fabricating missing tokens, cost, CO2, or attribution.

- Repository: `/Users/kevinlappe/Projects/session-data`
- Branch: `feat/product-cost-index-producer`
- Worktree: `/Users/kevinlappe/Projects/_worktrees/session-data/product-cost-index-producer`
- Paths owned: `docs`, `src`, `schemas`, `data`
- Merge policy: `parked`

### Tasks

- Inventory the active schema, local reports, token availability, attribution grain, and exact vault export path.
- Choose the join key and preserve the frozen product-cost-index contract.
- Emit a deterministic export with null-safe fields and no writes into authored product notes.
- Add producer fixtures and negative tests for missing evidence, ambiguous joins, and unknown pricing.

### Verification

#### preflight

- TEST-008
- Confirm local session-data reports are available and current.

#### local

- Producer unit tests and schema validation.

#### ci

- session-data repository gates.

#### integration

- TEST-007 after the export is consumed by Product Management.

#### negative

- No inferred token/cost/CO2 values.
- No runtime network pull or untracked source is silently treated as evidence.

### Acceptance

- The producer is unblocked by real local evidence.
- The export is versioned, deterministic, and contract-valid.
- The Product Management consumer can read it without mutating authored notes.

## Automation

### preflight

- Read the newest passoff for each repository before selecting a lane.
- Confirm the target repo, default branch, and task worktree.
- Run git status --short --branch and preserve dirty user-owned files.

### scheduling

- Run PR-001 before any implementation lane.
- Run PR-002 for Product Management plan authority and PR-003 for Lappe delivery independently after PR-001.
- Do not unpark PR-004 until its render/path decisions are resolved.
- Do not unpark PR-005 until TEST-008 supplies local evidence.

### closeout

- Run the affected repository gates.
- Record exact artifact/vault evidence for Obsidian validation.
- Update the relevant passoff and this coordination plan's workstream status without marking partial work done.
