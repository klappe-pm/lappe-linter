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
| 1.1 | `DEFAULT_PRIORITY_KEYS` becomes the 10-key default order | TODO | packages/core/src/config/defaults.ts |
| 1.2 | Drag-and-drop reordering on the key-sort list, writing through `updateYamlKeySort`; remove the separate insert flow | TODO | lappe-tab.ts |
| 1.3 | YAML section shows only kept options: blank-line-after-yaml, dedupe array values, remove-keys rows, timestamps; title alias, yaml-title, footnote options hidden | TODO | |
| 1.4 | Kept YAML toggles default ON | TODO | |

### Phase 2: Headers section

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | Core rule `header-case`: per-level style (camelCase, First letter, kebab-case, Title Case, underscore_formatted) | TODO | |
| 2.2 | Headers tab (renamed from Heading) with per-level dropdowns, alphabetical option order | TODO | |
| 2.3 | Filename flow: skip `Untitled*` until named; on rename, kebab-case the name (rename.mode gate) and sync H1 via h1-matches-stem | TODO | |
| 2.4 | Keep header-increment, headings-start-line, trailing-spaces, default ON | TODO | |

### Phase 3: Body and Special formatting

| # | Task | Status | Notes |
|---|---|---|---|
| 3.1 | Rename Content tab to Body; Basic Styling group (bold, underscore, italics) | TODO | |
| 3.2 | Core rule `paragraph-blank-lines` (0, 1, or 2 blank lines between paragraphs, default 1) | TODO | |
| 3.3 | Bullet rules: no blank lines between items, marker `- ` or `* ` (default `- `) | TODO | |
| 3.4 | Expose `join-paragraph-lines` (artificial line-break removal) in Body | TODO | |
| 3.5 | Special formatting section: code blocks, quotes, tables, callouts grouped, same layout pattern | TODO | |

### Phase 4: live preview

| # | Task | Status | Notes |
|---|---|---|---|
| 4.1 | Preview pane running `kitchenSinkFixture()` through `lappeLintText` with the drafted config, debounced re-render | TODO | |
| 4.2 | Side-by-side surface: preview left, settings right; opened from a Preview button per section | TODO | |

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
- 2026-07-10: Phase 0 done. Ribbon action extracted to a pure `ribbonFallback()` (editor-lint / whole-file-lint / notice) wired through `main.ts` `lintCurrentFile`, with a regression test; in reading view or with no note the wand now lints the whole file or shows a Notice instead of silently doing nothing. `test-vault` repaired: plugin folder renamed `obsidian-linter`→`lappe-linter`, `community-plugins.json` id fixed, esbuild dev-watch output path updated, and `scripts/install-test-vault.sh` added to build + copy `main.js`/`manifest.json`/`styles.css` and reconcile the enabled-plugin id. First-run onboarding: one-time Notice pointing at the create-linter.yaml command, gated by a persisted `lappeFirstRunNoticeShown` flag. Full suite green: 106 suites, 1682 tests.
