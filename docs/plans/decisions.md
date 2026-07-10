---
domain: development
category: obsidian-linter-fork
sub-category: decisions
date-created: 2026-07-10
date-revised: 2026-07-10
status: active
aliases:
  - linter decisions
tags:
  - decisions
  - harness
---
# decisions

## Protocol

Append-only decision log for the lappe-linter fork. Newest last. Each entry is `DEC-NNN` with date, context, decision, and consequences. Supersede by adding a new entry that names the one it replaces. Backlinks: [[README]] | [[project-tracker]].

## dec-001

- date: 2026-07-10
- context: Kevin renamed the product to lappe-linter and asked that adding new linting capabilities and changing preferences be easy for him specifically.
- decision: Product name is `lappe-linter`. Workspaces are `@lappe-linter/core`, `@lappe-linter/plugin`, `@lappe-linter/cli`. CLI binary is `lappe-linter`. Obsidian plugin id and name are `lappe-linter` and `Lappe Linter`. The GitHub repo slug from the plan is unchanged because upstream-sync history depends on it.
- consequences: All feature specs that say `linter-cli` map to the `lappe-linter` bin. README and manifests updated during F00.

## dec-002

- date: 2026-07-10
- context: The vault-root control-plane filename in every feature spec and in harness-changes.md is `linter.yaml`.
- decision: Keep `linter.yaml` as the canonical control-plane filename. Renaming it would fork the cross-repo contracts for no functional gain. The loader also accepts `lappe-linter.yaml` as an alias if present, with `linter.yaml` winning on conflict.
- consequences: No churn to HC-1 through HC-6. Alias support is a small add in the F01 loader.

## dec-003

- date: 2026-07-10
- context: Kevin wants low-friction extension and preference changes.
- decision: Extensibility is a first-class deliverable. Three surfaces. One, `linter.yaml` is the single commented preferences file, scaffolded with inline documentation for every default. Two, the F08 `RuleProvider` API is the no-fork path to add rules and note types. Three, a `lappe-linter new-rule <name>` scaffold command plus an authoring guide generate a rule stub, its test, and its registry entry.
- consequences: F01 scaffold output must be a commented template. F06 gains a `new-rule` subcommand. F08 ships the worked example provider and guide as the reference path.

## dec-004

- date: 2026-07-10
- context: F00 R2 says move upstream `src/rules/`, `option.ts`, `rules.ts`, `rules-runner.ts` into `packages/core` with zero obsidian imports. Inspection shows this underestimates the coupling. `option.ts` renders Obsidian `Setting` UI and imports `main`, `ui/helpers`, `ui/suggesters`, `ui/modals`. Six rules import `ui/modals/confirm-rule-disable-modal`. `rules.ts` and `rules-runner.ts` import `settings-data` and `ui/linter-components` types. `settings-data` and `option.ts` are mutually coupled. A clean full extraction is a multi-day untangle that would put the 1195 passing tests at risk.
- decision: F00 ships the workspace structure with the Obsidian plugin remaining at the repo root (upstream layout unchanged) and two new pure workspaces: `packages/core` (`@lappe-linter/core`, zero obsidian) and `packages/cli` (`@lappe-linter/cli`). All NEW feature work (F01 config, F02 scope, F03 note-types, F04 slugger, F05 content rules) lands in `packages/core` as pure functions. The headless CLI runs that pure core. Keeping the plugin at root also keeps `git merge upstream/master` conflict-free on paths, which serves the upstream-sync policy directly.
- consequences: The literal "move upstream rules into core" is descoped from F00 and reframed as incremental follow-up (extract upstream rules from the root plugin into `core` one cluster at a time, behind the F00 adapter seam, as each is needed by the CLI). F06 parity is defined against the core-native rule set, not the full upstream set. This unblocks all feature work immediately at zero regression risk. Supersedes the core-placement clause of F00 R2 only; every other F00 requirement (workspaces, CI, no-obsidian core, smoke test) stands.

## dec-005

- date: 2026-07-10
- context: Kevin redesigned the settings UI by direction while using the plugin. The upstream settings surface is too fragmented (too many tabs, tiny single-cell array entry widgets) and several upstream options are unwanted.
- decision: Settings tabs reduce to General, Lappe, Style (heading plus content plus spacing rules in one scrollable tab), Custom, Debug. The YAML, Footnote, and Paste tabs are removed. The Lappe tab owns all YAML behavior through one combined control ("this is the order YAML keys get sorted in"): a visible ordered list, an autocomplete key input over every vault frontmatter key (Enter adds, new keys allowed), and a same-pattern optional default-value input beside it. YAML title and YAML title alias are dropped. All sorting options are replaced by a single "Alphabetize property values" toggle that sorts the values on lines (aliases, tags, links) and never the keys. Timestamps are mandatory: date-created and date-revised are always managed, dates yyyy-MM-dd, time HHmm. kebab-case-filename and h1-matches-stem are on by default. Style files: a `linter-styles/` folder at the vault root next to linter.yaml holds named style files, each a profile fragment carrying its own folder bindings; the Lappe tab lists them, links to open each, and can create new ones; the loader merges them into the config as profiles (linter.yaml wins conflicts).
- consequences: Core gains `alphabetize-property-values` and a global `yaml-timestamp` rule (reusing the note-type date-keys engine with a fixed schema), a compiled default config with the mandatory rules enabled, and style-file merge support in the loader path. The upstream rules themselves stay registered (tests untouched); only their settings surfaces are removed or consolidated. The CLI must also learn the linter-styles folder; until it does, styles apply plugin-side only, tracked as a gap.
