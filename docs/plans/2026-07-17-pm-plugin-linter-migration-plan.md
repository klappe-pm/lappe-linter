# PM-plugin → lappe-linter migration plan (WS-A)

- Plan ID: `pm-plugin-linter-migration-v1`
- Status: `DONE`
- Parent: `docs/plans/2026-07-17-unified-system-plan.md`

## Resolution (2026-07-21)

Both lanes are complete; verified against `origin/master` (lappe-linter) and `origin/main` (product-management).

- Step 1 (lappe-linter core, PR-102): landed in PR #10. The `templates` subsystem (`packages/core/src/templates/`), config schema/loader/scaffold, provider API (`packages/core/src/providers/`), CLI `template` commands, and tests are all present.
- Step 1.3 gap closed 2026-07-21: the subsystem existed only in core + CLI and was never wired into the Obsidian plugin, so the built bundle users run did not contain it. Fixed on branch `feat/plugin-template-surface`: `LappeTemplateService`, "Create note from property template" and "Apply property template to the active note" commands, and a "Base template" mode in the preview view, with tests.
- Step 2 (product-management, PR-103): already complete on `origin/main` (PR #38 and predecessors). `grep -ri linter-config src` returns nothing, `styles.css` has no `.pm-config-*`, the `linterConfigPreview` settings migration is in `src/main.ts`, and the sanctioned provider stub (`src/linter-provider.ts`) plus its test (`test/linter-provider.test.ts`) exist. The local primary checkout was stale (PR #33), which made the severing look undone.
- Acceptance: provider fixtures are exercised on both sides (`packages/core/__tests__/providers/providers.test.ts`, PM `test/linter-provider.test.ts`).

## Why

Linter code drifted into `product-management-plugin` via PRs #29 (`codex/linter-config-preview`) and #31 (passoffs `2026-07-11-0842`, `2026-07-11-1248`). The PM repo's own plan (`docs/plans/2026-07-04-pipeline-integration-implementation-plan.md`) states the plugin "does not own Markdown lint execution." The 0842 passoff already flagged `linter-config-core.ts` as a shared core intended for a headless consumer — it was designed to be lifted. This lane lifts it, into the repo that owns linting.

## Principle: reconcile, don't transplant

`@lappe-linter/core` (~1,779 tests) stays the authoritative engine. The 2026-07-13 delivery plan explicitly forbids replacing it with the PM preview engine. So the migration is a **capability diff**, not a file copy:

| PM-plugin capability (`linter-config-core.ts`) | Already in @lappe-linter/core? | Action |
|---|---|---|
| Emphasis/special-formatting/list/blank-line/wrapping normalizers | Yes — `rules-content/` + upstream rules | Drop PM versions; keep core's. Port only test cases that cover gaps. |
| Heading casing incl. kebab/camel/Pascal per level | Partially — `header-case.ts` | Diff option sets; port missing casing modes into core rule. |
| `ruleExecutionOrder` pinned + manual/alphabetical tail | Yes — locked-first/manual/alphabetical ordering (PR-003 lane) | Drop PM version. |
| Code-fence protect/restore | Yes — `ignore-zones` | Drop PM version. |
| `ageBucket` | Yes — age scope matchers | Drop PM version. |
| **`BaseTemplateConfig` + `renderBaseNote()` (template body scaffold)** | **No** — note-types cover frontmatter only, not body scaffolds | **Port into core** as the `templates:` subsystem (WS-B). |
| **`pinnedOverrideKeys` (template-owned/toggleable attributes)** | **No** | **Port into core** (`templates.*.pinned-keys` + `toggles`). |
| `orderedFrontmatter` w/ FRONTMATTER_ORDER | Yes — note-type key-order + yaml-key-sort | Drop PM version; verify order parity in tests. |
| Scope descriptions (`describeScopes`) | Partially — scope-builder-model | Port display strings if better. |
| **Split preview view (`linter-config-view.ts`)** | Partially — `lappe-preview-view.ts` exists (PR-004) | **Merge UX**: adopt the two-pane controls-beside-note interaction into the existing workspace-leaf preview; do not keep two preview systems. |

## Steps

### Step 1 — lappe-linter side (PR-102)

1. Add `packages/core/src/templates/`: `types.ts` (BaseTemplate, pinned keys, toggles), `render.ts` (`renderBaseNote` ported + reconciled with note-types defaults), `resolve.ts` (global → by-scope inheritance using the existing scope resolver). Schema additions in `config/schema.ts` + loader/serializer/scaffold.
2. Port the unique test cases from `product-management-plugin/test/linter-config-core.test.ts` into `packages/core/__tests__/templates/`.
3. Extend `src/ui/lappe-preview-view.ts` with the split controls pane (interaction pattern from `linter-config-view.ts`); adapt `.pm-config-*` CSS into `src/styles.css` as `.lappe-config-*` using `--ll-*` tokens (sketches §11).
4. Parity: template rendering identical via CLI and plugin (extend `cli-parity` suite).

### Step 2 — product-management-plugin side (PR-103, after PR-102 merges)

Delete/sever, in one PR:

- Delete `src/linter-config-core.ts`, `src/linter-config-view.ts`, `test/linter-config-core.test.ts`, `test/linter-config-view.test.ts`.
- `src/main.ts`: remove view import (L4), `mergeLinterPreviewSettings` import (L10), `registerView` (L44-47), command `open-linter-config-preview` (L59-63), settings merge (L119), `activateLinterConfigView` (L235-243), `refreshLinterConfigViews` (L254-261).
- `src/settings.ts`: remove import (L4), `linterConfigPreview` field (L25) + default (L39), "Open preview" setting block (L185-195).
- `styles.css`: remove L381-492 (`.pm-config-*` + its 960px media query).
- Settings migration: on load, drop the `linterConfigPreview` key from `data.json` (one-time, logged) so the PM settings blob is clean.
- `docs/documentation/configuration-reference.md`: remove the "Linter and base-template preview" section; add a pointer to lappe-linter.
- Replace with the sanctioned integration: implement the provider stub (HC-5/F08) against `packages/core/src/providers/example-product-provider.ts` — PM contributes its note-types (project/epic/feature/task with parent-* keys) and report-only rules via the provider API. No cross-plugin source imports.

### Step 3 — cleanup

- Remove the empty `.obsidian/plugins/product-management/` install from the lappe-linter vault (pending decision recorded in PM passoff `2026-07-12-1311`).
- Update the cross-project plan of record (`2026-07-12-lappe-linter-consolidated-delivery-plan.md`) status roll-up to record the migration.

## Acceptance

- PM plugin builds and its remaining ~100 tests pass with zero linter source in-tree.
- lappe-linter template subsystem passes ported + new tests; preview shows controls-beside-note; CLI/plugin parity green.
- `grep -ri "linter-config" product-management-plugin/src` returns nothing.
- Provider stub registered and exercised by at least one test on each side of the boundary.

## Risks

- Silent behavior drift for anyone relying on the PM preview's exact formatting: mitigated by porting PM test cases before deleting them.
- The `.pm-config-preview` CSS reuses `.product-management-view`/`.pm-view-tabs` — extraction must not visually break the PM dashboard; keep the PM tab styles, take only the config-shell styles.
