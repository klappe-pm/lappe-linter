---
domain: development
category: obsidian-linter-fork
sub-category: plan
date-created: 2026-07-10
date-revised: 2026-07-10
status: ACTIVE
aliases:
  - lappe-linter settings redesign plan
tags:
  - plan
  - lappe-linter
---
# 2026-07-10-settings-redesign-plan

## Summary

Fix the dead-wand and no-visible-lint experience, then redesign the settings surface around the lappe core: YAML, Headers, Body, Special formatting, scoping with template inheritance, and a live preview. This file is both the plan and the work tracker; each task row updates as work lands. Branch: `feat/settings-redesign` in the linked worktree `lappe-linter-wt-settings-redesign`. Rigor: high (multi-file feature, shared plugin surface); checkpoints at each phase boundary.

## Diagnosis (2026-07-10 session)

The plugin loads and the core engine works; the failures are at the entry points.

- The repo-root vault install is correct and `data.json` writes prove `onload()` completes.
- `test-vault/.obsidian/plugins/obsidian-linter/` has only `data.json` and `.hotreload` (no `main.js`, no `manifest.json`) and `community-plugins.json` enables the old id `obsidian-linter`; any vault set up this way never loads the fork.
- The ribbon wand (`addLappeRibbonIcon`, `src/main.ts:600`) calls `executeCommandById('lappe-linter:lint-file')`, an `editorCheckCallback` that requires an active markdown editor in editing mode; in reading view or with no note open the click silently does nothing.
- All upstream `ruleConfigs` default to `enabled: false`, so the upstream pass is a no-op on a fresh vault; only the five lappe compiled defaults do anything, and they mostly touch frontmatter.
- Scoping exists in the core (path glob, extension, frontmatter property, tag matchers in `packages/core/src/scope/matchers.ts`) but is only reachable through `linter.yaml` and `linter-styles/`; the settings tab shows a read-only summary, so there is no scoping UI.
- CLI verification: `fix` on a messy fixture re-sorted keys into priority order, added `date-revised`, alphabetized tags, and rewrote the H1 to the filename stem.

## Decisions

- The lappe core is the single engine going forward; upstream rule tabs are regrouped into the new sections and legacy-only options are hidden, not deleted, this round.
- The timestamp keys are `date-created` and `date-revised` (the request's one mention of `date-updated` is treated as `date-revised`, matching the core, the vault conventions, and the rest of the request).
- Default YAML key order ships as: `preset`, `domain`, `category`, `sub-category`, `types`, `date-created`, `date-revised`, `links`, `aliases`, `tags`.
- Kept toggles default ON (opt-out model) for the lappe-owned rules; upstream rule defaults in `data.json` are only flipped for rules surfaced in the new sections.
- Backlink and alias scoping need the Obsidian metadata cache, so those matchers are plugin-side context passed into the core resolver; the CLI skips them.
- `aliases` and `tags` are pinned last, not part of the reorderable `priority-keys` (which is the 8 keys `preset`..`links`). Reason: the core's `rankKey` always sorts aliases/tags last because their array values are visually bulky, and listing them in `priority-keys` would instead push unlisted keys (like `status`) below them, breaking a guarantee the user's notes rely on. The settings list still shows all 10 in order, with aliases/tags rendered as fixed trailing rows.

## Phase tracker

Statuses: TODO, ACTIVE, DONE, BLOCKED (with reason in Notes).

### Phase 0: entry-point fixes

| # | Task | Status | Notes |
|---|---|---|---|
| 0.1 | Ribbon wand falls back to `runLinterFile(activeFile)` when the editor command check fails, with a Notice when there is no markdown file | DONE | ribbonFallback() in src/lappe/ribbon-action.ts, wired in main.ts lintCurrentFile; test __tests__/lappe-ribbon-action.test.ts |
| 0.2 | Repair `test-vault`: plugin folder renamed to `lappe-linter`, correct id in `community-plugins.json`, install script copies dist build | DONE | git mv obsidian-linter→lappe-linter, id fixed, scripts/install-test-vault.sh, esbuild watch path updated |
| 0.3 | Fresh-install defaults ON for lappe-owned rules; first-run notice offers Create linter.yaml | DONE | Core lappe rules already ON via defaultLinterConfig; one-time first-run Notice (lappeFirstRunNoticeShown flag) in main.ts maybeShowFirstRunNotice |

### Phase 1: YAML section

| # | Task | Status | Notes |
|---|---|---|---|
| 1.1 | `DEFAULT_PRIORITY_KEYS` becomes the 10-key default order | DONE | 8 priority keys (preset..links) in defaults.ts + key-rank HEAD + scaffold; aliases/tags stay pinned-last (see decision), scaffold+dec-005 tests updated. The visible 10-key order is priority-8 + aliases + tags. |
| 1.2 | Drag-and-drop reordering on the key-sort list, writing through `updateYamlKeySort`; remove the separate insert flow | DONE | HTML5 drag rows in lappe-tab renderKeySortList; pure moveItem() in src/lappe/reorder.ts with test; up/down retained as a11y fallback; aliases/tags shown as pinned trailing rows |
| 1.3 | YAML section shows only kept options: blank-line-after-yaml, dedupe array values, remove-keys rows, timestamps; title alias, yaml-title, footnote options hidden | DONE | Upstream YAML/Footnote tabs already removed (dec-005); kept rules surfaced in a Lappe "YAML formatting" group via displayKeptYamlRules() |
| 1.4 | Kept YAML toggles default ON | DONE | LAPPE_DEFAULT_ON_RULES seeded enabled on first install in main.ts (opt-out; never overrides a returning user's choice) |

### Phase 2: Headers section

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | Core rule `header-case`: per-level style (camelCase, First letter, kebab-case, Title Case, underscore_formatted) | DONE | packages/core/src/rules-content/header-case.ts + pure formatHeadingText + tests; registered, examples + idempotency covered |
| 2.2 | Headers tab (renamed from Heading) with per-level dropdowns, alphabetical option order | DONE | Headers section in lappe-tab displayHeadersSection; H1..H6 dropdowns (styles listed alphabetically by HEADER_CASE_STYLES) writing via new config-service setDefaultRuleOption; header-case enabled in compiled defaults (no-op until a level set) |
| 2.3 | Filename flow: skip `Untitled*` until named; on rename, kebab-case the name (rename.mode gate) and sync H1 via h1-matches-stem | DONE | pure shouldLintOnRename() + tests; vault rename handler in main.ts lints on the Untitled→real-name transition, applying kebab-case-filename (rename.mode gate) and h1-matches-stem |
| 2.4 | Keep header-increment, headings-start-line, trailing-spaces, default ON | DONE | added to LAPPE_DEFAULT_ON_RULES and surfaced in the Headers section |

### Phase 3: Body and Special formatting

| # | Task | Status | Notes |
|---|---|---|---|
| 3.1 | Rename Content tab to Body; Basic Styling group (bold, underscore, italics) | DONE | Body section in lappe-tab displayBodySection with a Basic styling subgroup (emphasis-style, strong-style upstream rules) |
| 3.2 | Core rule `paragraph-blank-lines` (0, 1, or 2 blank lines between paragraphs, default 1) | DONE | packages/core/src/rules-content/paragraph-spacing.ts (id paragraph-spacing) + tests; enabled in compiled defaults; Body dropdown 0/1/2 |
| 3.3 | Bullet rules: no blank lines between items, marker `- ` or `* ` (default `- `) | DONE | packages/core/src/rules-content/list-style.ts + tests; marker dropdown + tight-lists toggle in Body; enabled by default |
| 3.4 | Expose `join-paragraph-lines` (artificial line-break removal) in Body | DONE | "Remove artificial line breaks" toggle in Body writing join-paragraph-lines enabled |
| 3.5 | Special formatting section: code blocks, quotes, tables, callouts grouped, same layout pattern | DONE | displaySpecialFormattingSection groups code-fence, blockquote, and table upstream rules via the shared renderUpstreamRule helper; no dedicated callout rule exists upstream (noted) |

### Phase 4: live preview

| # | Task | Status | Notes |
|---|---|---|---|
| 4.1 | Preview pane running `kitchenSinkFixture()` through `lappeLintText` with the drafted config, debounced re-render | DONE | LappePreviewModal lints a rich PREVIEW_SAMPLE (frontmatter, H1-H3, lists, bold/italic, quote, table, callout, code) through lappeLintText; re-renders on linter.yaml modify. Sample extracted to a pure module with a lint + idempotency test |
| 4.2 | Side-by-side surface: preview left, settings right; opened from a Preview button per section | PARTIAL | Preview button on each section heading opens a before/after side-by-side modal. It refreshes when linter.yaml changes on disk, but a modal blocks the settings tab, so it is a snapshot per open rather than a live-while-editing split. A non-blocking workspace-leaf split is the remaining upgrade (noted for a follow-up) |

### Phase 5: scoping UI and inheritance

| # | Task | Status | Notes |
|---|---|---|---|
| 5.1 | Age matcher: `today - date-created` in 5-day buckets, created-today rounds up to 1 | TODO | |
| 5.2 | Date-created and date-revised range matchers | TODO | |
| 5.3 | Backlinks and aliases matchers via plugin-passed metadata context; CLI skips them | TODO | |
| 5.4 | Scope builder UI: multi-select scope types, per-type fields with vault-value autocomplete, writes named profiles back comment-preserving | TODO | |
| 5.5 | `project` preset available under types scope | TODO | |
| 5.6 | Inheritance UI: per-option inherited-vs-override state and a push-template-changes action that strips redundant overrides | TODO | |

### Phase 6: rule ordering

| # | Task | Status | Notes |
|---|---|---|---|
| 6.1 | Priority-order control: first rule locked (lock icon), manual drag or alphabetical ordering, global and per scope, persisted in linter.yaml | TODO | |

## Verification gates

- `npm test` green in the worktree before each phase commit (targeted suites during development, full suite at phase close).
- Build `npm run build` green; bundle installed into `test-vault` for a manual smoke pass at close.
- Every new core rule has a test sibling; the ribbon fallback has a regression test.

## Work log

- 2026-07-10: plan written; diagnosis session verified engine via CLI; worktree `feat/settings-redesign` created.
- 2026-07-10: Phase 4 done (4.2 partial). LappePreviewModal shows a rich sample note before and after linting with the live resolved config and re-renders when linter.yaml changes on disk; a Preview button sits on each section heading. The sample is a pure module (`preview-sample.ts`) with a lint + idempotency test proving the preview path. 4.2 is a snapshot modal rather than a live-while-editing split (a modal blocks the settings tab); a non-blocking workspace-leaf split is deferred and recorded in the tracker. Suite green: 112 suites, 1755 tests.
- 2026-07-10: Phase 3 done. Two new core rules: `paragraph-spacing` (normalize blank-line runs to 0/1/2, default 1, preserving masked blocks and trimming file ends) and `list-style` (normalize unordered markers to `-`/`*`, tighten lists by removing inter-item blanks, leaving ordered lists and thematic breaks alone); both with example + edge-case tests and enabled in the compiled defaults. Lappe tab gains Body (paragraph spacing, bullet marker, tight-lists, remove-artificial-line-breaks via join-paragraph-lines, plus a Basic styling subgroup for emphasis/strong) and Special formatting (code, quote, table upstream rules) sections; upstream-rule rendering deduplicated into a shared renderUpstreamRule helper, and the Body/Headers-managed core rules excluded from the generic toggles. Suite green: 111 suites, 1753 tests. Fixed a doubled-trailing-newline bug in list-style during development (caught by the idempotency test).
- 2026-07-10: Phase 2 done. New core rule `header-case` normalizes each ATX level to one of five styles via a pure, idempotent `formatHeadingText` (camelCase, First letter, kebab-case, Title Case, underscore_formatted), skipping code/math/table/frontmatter lines; unit + example + idempotency tests. Headers section added to the Lappe tab with H1..H6 style dropdowns writing to linter.yaml through a new `setDefaultRuleOption`, plus the kept upstream heading rules. Filename flow: a pure `shouldLintOnRename` fires a lint on the Untitled→real-name transition so kebab-case-filename and h1-matches-stem run when a note is first named. header-increment, headings-start-line, trailing-spaces added to the opt-out default-on set. Suite green: 109 suites, 1720 tests.
- 2026-07-10: Phase 1 done. `DEFAULT_PRIORITY_KEYS`/`GLOBAL_KEY_ORDER_HEAD`/scaffold set to the 8 priority keys `preset`..`links` (aliases/tags pinned last, see decision); the key-sort list rows now drag to reorder through a pure tested `moveItem()` with up/down as a fallback, and aliases/tags render as fixed trailing rows so the full 10-key order is visible. Kept upstream YAML rules (blank-line-after-yaml, dedupe-array-values, remove-keys) surfaced in a Lappe "YAML formatting" group; yaml-title, title-alias, and footnote rules remain absent (dec-005 removed those tabs). Kept YAML rules ship enabled on first install via `LAPPE_DEFAULT_ON_RULES`, never overriding a returning user's opt-out. Suite green: 107 suites, 1687 tests.
- 2026-07-10: Phase 0 done. Ribbon action extracted to a pure `ribbonFallback()` (editor-lint / whole-file-lint / notice) wired through `main.ts` `lintCurrentFile`, with a regression test; in reading view or with no note the wand now lints the whole file or shows a Notice instead of silently doing nothing. `test-vault` repaired: plugin folder renamed `obsidian-linter`→`lappe-linter`, `community-plugins.json` id fixed, esbuild dev-watch output path updated, and `scripts/install-test-vault.sh` added to build + copy `main.js`/`manifest.json`/`styles.css` and reconcile the enabled-plugin id. First-run onboarding: one-time Notice pointing at the create-linter.yaml command, gated by a persisted `lappeFirstRunNoticeShown` flag. Full suite green: 106 suites, 1682 tests.
