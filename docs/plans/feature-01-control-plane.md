---
domain: development
category: obsidian-linter-fork
sub-category: feature
date-created: 2026-07-09
date-revised: 2026-07-09
dependencies: F00
feature-id: F01
pr-count: 2
status: planned
aliases:
  - control plane
tags:
  - feature
  - configuration
---
# feature-01-control-plane

## Feature name
Control plane: `linter.yaml` as source of truth.

## Objective
Replace scattered settings with one git-tracked YAML file at the vault root that owns all rule configuration, profiles, and note-type schemas. The Obsidian settings UI becomes a view over this file. This is the "simplified control plane" coordinating every option in the system.

## Components
Config schema (TypeScript types plus a JSON Schema export for editor validation), config loader and validator in core, file watcher in plugin (reload on external change, e.g. git pull), UI writeback (settings tab edits serialize to `linter.yaml`, comment-preserving via the `yaml` package document API upstream already depends on), migration command that emits `linter.yaml` from current `data.json`, conflict policy (file wins; UI shows a reload banner when the file changed underneath an open settings tab).

## Config shape
```yaml
version: 1
defaults:
  rules:
    yaml-key-sort:
      enabled: true
      priority-keys: [domain, category, sub-category, date-created, date-revised]
profiles:
  tasks-notes:
    match:
      frontmatter: { category: task }
    rules: { }
note-types: { }
rename: { mode: flag }
ignore:
  folders: []
  files: []
```

## Requirements
R1: Loader validates against schema; a validation error disables linting and surfaces one Notice, never a partial apply. R2: Round trip UI edit to YAML preserves unknown keys and comments. R3: `data.json` persists only UI state (last tab, log level), never rule config. R4: Migration command is idempotent. R5: CLI (F06) consumes the identical loader. R6: Missing `linter.yaml` falls back to compiled defaults and offers to scaffold one.

## Tests
Loader unit tests: valid, invalid, partial, unknown-key, comment-preservation round trip. Migration test from a captured upstream `data.json` fixture. Watcher debounce test.

## Tasks
| ID | Task | Status |
| --- | --- | --- |
| F01-T1 | Define config types and JSON Schema in core | planned |
| F01-T2 | Loader plus validator with fail-closed semantics | planned |
| F01-T3 | Comment-preserving serializer | planned |
| F01-T4 | Plugin file watcher and reload | planned |
| F01-T5 | Settings UI writeback | planned |
| F01-T6 | data.json to linter.yaml migration command | planned |
| F01-T7 | Scaffold command for missing config | planned |

## PR breakpoints and seeded commits
PR 1 (core): `feat(core): linter.yaml schema, loader, and validator`, `feat(core): comment-preserving yaml serializer`, `test(core): config loader and round-trip suite`. PR 2 (plugin): `feat(plugin): watch and reload linter.yaml as source of truth`, `feat(plugin): settings ui writeback to linter.yaml`, `feat(plugin): migrate data.json rule config to linter.yaml`.

## Agent prompt
```text
Implement feature-01-control-plane.md tasks F01-T1 through F01-T7 in klappe-pm/lappe-linter. linter.yaml at the vault root is the single source of truth for rule configuration; data.json may hold UI state only. Validation failures must disable linting entirely with a single user-facing Notice. UI edits must round-trip through the yaml document API preserving comments and unknown keys. Do not implement profile matching semantics; that is F02. Ship the schema with profiles and note-types keys present but pass-through.
```

## Dependencies
[[feature-00-fork-and-monorepo]].

## Backlinks
[[README]] | [[project-tracker]]
