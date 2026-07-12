---
domain: development
category: obsidian-linter-fork
sub-category: plan
date-created: 2026-07-10
date-revised: 2026-07-10
status: ACTIVE
aliases:
  - lappe-linter settings tabs redesign plan
tags:
  - plan
  - lappe-linter
---
# 2026-07-10-settings-tabs-redesign-plan

## Status

This is the active Lappe settings implementation source plan and is coordinated by `2026-07-12-lappe-linter-consolidated-delivery-plan.md`. Its requirements remain open until the real settings tabs and Obsidian acceptance checks pass.

## The one thing the last session got wrong

The requirement was to redesign the plugin's own settings tabs in place: rename the existing "Heading" tab to "Headers", rename "Content" to "Body", simplify the "YAML" tab, and add a "Special formatting" tab. The last session instead put everything into a separate bolted-on "Lappe" tab and left the real Heading/Content/YAML tabs untouched, so the user never saw the redesign no matter which vault or build was loaded. Fix the architecture first: the redesign must live in the plugin's real, named tabs. There must be no tab named "Lappe" and no combined "Style" tab.

## Ground truth for the next session

- Repo: `~/Projects/lappe-linter` (master, pushed to `origin`). The Obsidian plugin lives at the repo root (upstream layout); a pure rule core is in `packages/core`; a CLI in `packages/cli`.
- Settings entry point: `src/ui/settings.ts` `addTabs()`. It currently registers General, Lappe, Style (a `RuleTab` over HEADING+CONTENT+SPACING rules), Custom, Debug.
- The wrong-place UI lives in `src/ui/linter-components/tab-components/lappe-tab.ts` (`LappeTab`), which has working section renderers (key-sort drag list, header-case dropdowns, body controls, special formatting, scope builder, rule order). Reuse these renderers, but move them into properly named tabs.
- Upstream rule tabs use `RuleTab` (`src/ui/linter-components/tab-components/rule-tab.ts`), which renders every `Rule` of a given `RuleType` (`src/rules.ts`, `ruleTypeToRules`). Rule types: YAML, HEADING, FOOTNOTE, CONTENT, SPACING, PASTE.
- The pure core engine already exists and is tested: rules `header-case`, `paragraph-spacing`, `list-style`, scope matchers (age, date ranges, backlinks, aliases), `linter.yaml` loader, rule ordering. Full suite is green (116 suites, 1779 tests). Keep the core; only the UI placement is wrong.
- Build: `npm run build` then `npm run minify-css`, then copy `main.js`/`manifest.json`/`styles.css` into a vault's `.obsidian/plugins/lappe-linter/`. `scripts/install-test-vault.sh [--no-build] [vault-path]` does this. Version is 1.33.0 in `manifest.json`.
- A working-tree edit to `lappe-tab.ts` was left half-finished this session (a parameterized-sections refactor plus a dangling `legacyUnusedSectionList` method). Task 0 reverts it.

## Deliverable definition (what "done" means)

The user opens the Linter plugin settings in any vault where the build is installed and sees tabs named exactly: General, YAML, Headers, Body, Special formatting, Scopes, Rule order, Custom, Debug. No "Lappe" tab, no "Style" tab. Each redesigned tab behaves per the spec below. The wand lints the current file. A one-click "create example note" drops a real markdown file in the vault for testing. Verified by installing the build and loading it (toggle the plugin off then on in Community plugins forces a reload from disk without a full restart).

## Tasks (ordered; each ends green: `npm test` and `npm run build`)

### Task 0: clean baseline

- Revert the uncommitted half-refactor: `git checkout -- src/ui/linter-components/tab-components/lappe-tab.ts`. Confirm `npm test` and `npm run build` are green before starting.

### Task 1: restructure the tabs (the core fix)

- In `src/ui/settings.ts` `addTabs()`, remove the `LappeTab` registration and the combined `Style` `RuleTab`.
- Register real tabs in this order: General, YAML, Headers, Body, Special formatting, Scopes, Rule order, Custom, Debug.
- Refactor `LappeTab` into a section-parameterized tab (constructor takes a tab name plus the list of sections to render), or split it into small tab classes, so each named tab renders only its own sections. Reuse the existing section methods.
- Section-to-tab mapping:
  - YAML: linter.yaml status header, key-sort drag list, kept YAML formatting rules, "create example note" button.
  - Headers: per-level header-case controls, kept heading rules (header-increment, headings-start-line, trailing-spaces).
  - Body: paragraph spacing, bullet/list style, remove-artificial-line-breaks, basic styling (bold/italic/underscore).
  - Special formatting: code fences, quotes, tables, callouts, code checks.
  - Scopes: scope builder, excluded folders, styles, profile list with inheritance.
  - Rule order: locked-first rule, drag or alphabetical ordering.
- Render each section defensively (wrap in try/catch so one failing section shows an inline error rather than blanking the whole tab).
- Delete `lappe-tab.ts`'s "Lappe" tab name usage and the `LappePreviewModal` wiring (the modal is replaced by the example-note button, per the user: the preview is just a markdown note).

### Task 2: debug the wand (was reported dead)

- The ribbon calls the editor-only lint command, which silently no-ops in reading view or with no note open. Make the ribbon fall back to whole-file lint, and show a Notice when there is no markdown file. (A `ribbonFallback` helper already exists from the prior session; verify it is wired and tested.)

### Task 3: YAML tab, per the original spec

- Default YAML key order shown in this order, drag-and-drop to reorder: preset, domain, category, sub-category, types, date-created, date-revised, links, aliases, tags, then a trailing blank key/value row.
- Key and value inputs show all existing vault values alphabetically and narrow as the user types (use the existing `ListSuggest`/`vaultYamlKeys`/`vaultYamlValues` in `src/lappe/yaml-suggest.ts` for true autocomplete, not free-text). This was downgraded to free text last session; restore the autocomplete.
- One blank key/value row by default; same add/remove row pattern for keys and values; remove the separate "insert" flow (drag replaces it); remove the separate "key sort" option.
- Keep: add blank line after YAML, dedupe YAML array values, remove YAML keys/values (same row pattern), timestamp fields date-created and date-revised. All kept YAML toggles default ON.
- Remove from the UI: title alias, YAML title, footnote options.

### Task 4: Headers tab

- Rename the tab from Heading to Headers.
- Per-header-level formatting, options listed alphabetically: camelCase, First letter, kebab-case, Title Case, underscore_formatted.
- File title is the first source option; default title format kebab-case. On file create, ignore Obsidian's default "Untitled" name; once a real filename is entered, format it and set the H1 from the filename; H2 and H3 follow the configured rules.
- Keep header increment (default ON), include-heading-start-line (default ON), trailing spaces (default ON).

### Task 5: Body tab

- Rename the Content tab to Body. Group: Basic Styling (Bold, Underscore, Italics).
- Paragraph spacing: blank lines between paragraphs, options 0, 1, or 2.
- Bullet lists: default no blank lines between items; marker `- ` or `* `, default `- `.
- Remove artificial line breaks (pasted text, email, AI text, window-width wraps) so lines wrap naturally and are not hard-broken.

### Task 6: Live preview as a markdown note (lightest possible)

- A button that creates a real messy example note in the vault (frontmatter, H1/H2/H3, paragraphs, bullets, bold/italic/underscore, code block, quote, table, callout) and opens it. The user views it beside the settings using Obsidian's own split pane and lints it to see the settings applied. Do not build an in-app renderer or a blocking modal.

### Task 7: Rule ordering

- Priority-order control: the first/default rule has a lock icon (fixed first). Remaining rules sort by manual drag order or alphabetical. Applies globally and inside scoped settings.

### Task 8: Special formatting tab

- A tab for code blocks, quotes, tables, callouts, and other markdown-specific formatting, using the same row layout as the Body and YAML tabs.

### Task 9: Scoping system

- Reusable scoping: the base settings are the template for scoped configs. Scope types: folder, file, file path, properties, tags, backlinks, aliases, domain, category, sub-category, date created, date revised, age, project, types. Add project as a default option under types. All selectors multi-select.
- Age = today minus date-created, displayed in 5-day buckets (1-5, 6-10, ...); a note created today rounds up to 1. (Core `ageBucket` already implements this.)
- Scope UI: choose one or more scope types from a multi-select dropdown; as types are selected, their configuration fields appear to the right; the menu closes on outside click; the example-note preview reflects the scoped settings. Fields use vault-value autocomplete (folders, tags, property values), not free text.

### Task 10: Template inheritance

- Scoped configs inherit from the base template unless they override a specific option. A later base change propagates to non-overridden scoped values. Provide an explicit action to push template changes into associated scoped configs. Model this like project-level permission inheritance: base provides defaults, scope overrides, non-overridden values stay linked. (Core merge semantics and a `pushDefaultsToProfiles` helper already exist.)

### Task 11: YAML metadata integration

- Scope matching and preview use YAML metadata: preset, domain, category, sub-category, types, project, date-created, date-revised, tags, aliases, links.

## Verification (do this before claiming done)

1. `npm test` and `npm run build` green.
2. `scripts/install-test-vault.sh` into a throwaway vault; open Obsidian on it; in Community plugins toggle the plugin off then on (forces reload from disk).
3. Open the plugin settings and confirm the tab names are General, YAML, Headers, Body, Special formatting, Scopes, Rule order, Custom, Debug, with no "Lappe" tab.
4. Click "create example note", open it split beside settings, run the wand, and confirm the visible changes match the configured rules (H1 from filename, key order, paragraph spacing, bullet marker, line-break removal).
5. Only after seeing it work in Obsidian, mark tasks done. Do not mark UI items done from tests alone; the prior session's failure was exactly that.

## Hard constraints for the next session

- No tab named "Lappe". No combined "Style" tab. The redesign is in the plugin's real tabs.
- Re-read this plan and the user's original message against the diff before marking anything done. Do not downgrade a spec item (e.g. autocomplete to free text, side-by-side to a modal) and call it done.
- The plugin was never published; it only reaches a vault by copying files into `.obsidian/plugins/lappe-linter/`. Installing "Linter" from the community store gives the old upstream plugin, not this fork.
- Keep the pure core and its tests; the engine is correct. Only the settings UI placement needs rebuilding.
