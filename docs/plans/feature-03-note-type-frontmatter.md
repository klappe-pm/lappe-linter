---
domain: development
category: obsidian-linter-fork
sub-category: feature
date-created: 2026-07-09
date-revised: 2026-07-09
dependencies: F01, F02
feature-id: F03
pr-count: 1
status: planned
aliases:
  - note-type frontmatter
tags:
  - feature
  - frontmatter
---
# feature-03-note-type-frontmatter

## Feature name
Note-type frontmatter schemas.

## Objective
Frontmatter defined per note type. Each note type (project, feature, epic, task, daily, reference, and any user-defined type) declares required keys, default values, allowed value sets, and key order. The linter inserts missing keys, orders keys, and validates values, per resolved scope.

## Components
Schema model in `note-types` section of `linter.yaml`: per type, `required` (key list with optional defaults), `key-order` (defaults to the global order: domain, category, sub-category, date-created, date-revised, remaining alphabetical, aliases and tags last), `values` (enum constraints per key), `date-keys` (auto-set date-created on first lint, date-revised on change). Three core rules: `note-type-insert-keys`, `note-type-key-sort` (delegates to the existing yaml-key-sort engine with per-type priority lists), `note-type-validate` (report-only; violations surface in plugin Notice and CLI nonzero exit). Type detection reuses F02 frontmatter matchers; a note's type is the note-type whose matcher resolves, exposed to rules through the resolved profile context.

## Requirements
R1: Insert never overwrites existing values; defaults apply only to absent keys. R2: Key sort is stable and idempotent; two consecutive runs produce zero diff. R3: date-revised updates only when the lint run changed content other than date-revised itself, preventing infinite churn in git. R4: Flat scalar and list values only, matching the SQL-ingestion constraint; nested maps in managed keys are a validation error. R5: Validation is report-only by default; no destructive fixes to values.

## Tests
Idempotency test on every schema fixture. date-revised churn test (lint of already-clean file leaves mtime-relevant content unchanged). Per-type ordering fixtures for project, feature, epic, task. Enum violation reporting test.

## Tasks
| ID | Task | Status |
| --- | --- | --- |
| F03-T1 | note-types config schema and loader validation | planned |
| F03-T2 | note-type-insert-keys rule | planned |
| F03-T3 | note-type-key-sort rule over yaml-key-sort engine | planned |
| F03-T4 | note-type-validate rule with structured violation output | planned |
| F03-T5 | date-created and date-revised handling with churn guard | planned |
| F03-T6 | Fixture suite for the six starter note types | planned |

## PR breakpoints and seeded commits
Single PR: `feat(core): note-type schemas with insert, sort, and validate rules`, `feat(core): date-created and date-revised management with churn guard`, `test(core): note-type idempotency and validation fixtures`.

## Agent prompt
```text
Implement feature-03-note-type-frontmatter.md tasks F03-T1 through F03-T6. Hard constraints: rules must be idempotent (second run yields zero diff, tested); insertion never overwrites existing values; date-revised must not update unless other content changed in the same run; managed frontmatter is flat scalars and lists only. Reuse the yaml-key-sort priority mechanism rather than writing a second sorter. Validation reports, it does not fix values.
```

## Dependencies
[[feature-01-control-plane]] | [[feature-02-scope-engine]].

## Backlinks
[[README]] | [[project-tracker]]
