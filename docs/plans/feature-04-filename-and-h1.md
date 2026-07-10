---
domain: development
category: obsidian-linter-fork
sub-category: feature
date-created: 2026-07-09
date-revised: 2026-07-09
dependencies: F01, F02
feature-id: F04
pr-count: 2
status: planned
aliases:
  - filename and h1
tags:
  - feature
  - rename
---
# feature-04-filename-and-h1

## Feature name
Filename and H1 enforcement: kebab-case, underscore removal, H1 matches stem.

## Objective
Enforce kebab-case filenames (lowercase, hyphens, no underscores, no spaces) and an H1 that matches the filename stem exactly. Two modes behind a per-scope setting: `flag` reports violations; `rename` fixes them, with link updates.

## Components
Core: `kebab-case-name` pure function (Unicode-aware slugger: lowercase, spaces and underscores to hyphens, strip punctuation except hyphens, collapse repeats, trim) with a collision suffix strategy; `h1-matches-stem` rule (insert or rewrite the first H1 to the stem; interacts with upstream file-name-heading, which this rule supersedes when enabled, enforced via the existing disableConflictingOptions mechanism). Plugin: rename executor using `app.fileManager.renameFile`, which rewrites wikilinks and markdown links vault-wide; collision detection against existing paths before rename; batch rename command with dry-run preview modal. CLI behavior (lands with F06): `flag` mode always available; `rename` mode requires `--allow-rename` and rewrites links itself using the core link-rewriter over a vault-wide scan, or refuses when the vault index cannot be built.

## Requirements
R1: Rename never executes on collision; the file is flagged with the proposed name instead. R2: H1 rewrite preserves everything after the H1 line and any content before it except a conflicting H1. R3: Mode is scope-resolvable: `rename` in owned project folders, `flag` in shared or synced folders. R4: The slugger is the single naming function, exported for reuse by harness scripts. R5: Files excluded by ignore config are never renamed. R6: Plugin rename path is the default recommendation; CLI rename is opt-in and documented as riskier.

## Tests
Slugger table tests (spaces, underscores, camelCase, unicode, emoji, repeated separators, leading and trailing junk). Collision test. H1 idempotency test. Plugin integration test with a fixture vault asserting wikilink and markdown link rewrite after rename (obsidian API mocked at the adapter seam).

## Tasks
| ID | Task | Status |
| --- | --- | --- |
| F04-T1 | Slugger with collision suffix strategy in core | planned |
| F04-T2 | h1-matches-stem rule with conflict disable of file-name-heading | planned |
| F04-T3 | Plugin rename executor via fileManager with collision guard | planned |
| F04-T4 | Batch rename command with dry-run preview | planned |
| F04-T5 | Per-scope mode setting (off, flag, rename) | planned |
| F04-T6 | Core link-rewriter for CLI rename mode | planned |

## PR breakpoints and seeded commits
PR 1 (core): `feat(core): kebab-case slugger and h1-matches-stem rule`, `test(core): slugger and h1 idempotency tables`. PR 2 (plugin): `feat(plugin): scope-aware rename executor with link updates and dry-run`, `feat(core): link rewriter for headless rename`, `test(plugin): fixture-vault rename and link integrity`.

## Agent prompt
```text
Implement feature-04-filename-and-h1.md tasks F04-T1 through F04-T6. Safety constraints are absolute: never rename onto an existing path; never rename files matched by ignore config; plugin renames go through app.fileManager.renameFile so Obsidian rewrites links; CLI rename requires --allow-rename and the core link-rewriter, refusing when a vault index cannot be built. The slugger is one exported function used everywhere. H1 handling must disable the upstream file-name-heading rule via disableConflictingOptions, not coexist with it.
```

## Dependencies
[[feature-01-control-plane]] | [[feature-02-scope-engine]].

## Backlinks
[[README]] | [[project-tracker]]
