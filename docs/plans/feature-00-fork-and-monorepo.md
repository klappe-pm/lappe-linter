---
domain: development
category: obsidian-linter-fork
sub-category: feature
date-created: 2026-07-09
date-revised: 2026-07-09
dependencies: none
feature-id: F00
pr-count: 2
status: planned
aliases:
  - fork and monorepo
tags:
  - feature
  - infrastructure
---
# feature-00-fork-and-monorepo

## Feature name
Fork and monorepo restructure.

## Objective
Establish klappe-pm/lappe-linter as a hard fork with npm workspaces and a `packages/core` that compiles with zero Obsidian imports, proving the shared TypeScript core is viable before any feature work begins.

## Components
`packages/core` (rules, registry, option types, utils, lang shim), `packages/plugin` (main.ts, UI, vault integration, esbuild config), `packages/cli` (empty scaffold with entry point, filled by F06), root workspace config, upstream remote and sync documentation, CI workflow running build and tests on both packages.

## Requirements
R1: `git remote upstream` configured; sync procedure documented in README. R2: All files under upstream `src/rules/`, `src/utils/`, `src/option.ts`, `src/rules.ts`, `src/rules-registry.ts`, `src/rules-runner.ts` move to `packages/core/src/` preserving relative paths. R3: `obsidian` imports removed from core; the two rules that touch the App object (conflict-disable callbacks) get an injected interface defined in core and implemented in plugin. R4: Language strings load through a shim so core compiles without the plugin's lang loader. R5: Plugin builds and behaves identically to upstream 1.31.x; the existing jest suite passes unmoved. R6: GitHub Actions workflow: install, build all workspaces, test all workspaces, on push and PR.

## Tests
Existing upstream jest suite passes from its new location with zero test-body edits (import path edits only). A new smoke test imports the registry from `packages/core` in a plain Node context and asserts rule count matches upstream and that `require('obsidian')` is never resolved (mock resolver that throws).

## Tasks
| ID | Task | Status |
| --- | --- | --- |
| F00-T1 | Fork repo, add upstream remote, branch `feat/monorepo` | planned |
| F00-T2 | Add root workspaces config, move plugin code to packages/plugin | planned |
| F00-T3 | Extract rules, registry, runner, utils to packages/core preserving paths | planned |
| F00-T4 | Define AppAdapter interface in core; implement in plugin | planned |
| F00-T5 | Lang string shim in core | planned |
| F00-T6 | Repoint jest, fix imports, suite green | planned |
| F00-T7 | Node smoke test proving core has no obsidian dependency | planned |
| F00-T8 | CI workflow | planned |

## PR breakpoints and seeded commits
PR 1 (structure): `chore(repo): convert to npm workspaces with plugin package`, `chore(core): extract rules and runner to packages/core preserving upstream paths`, `feat(core): add AppAdapter and lang shims to decouple core from obsidian`. PR 2 (verification): `test(core): node smoke test asserting zero obsidian imports`, `chore(repo): ci workflow building and testing all workspaces`.

## Agent prompt
```text
You are working in klappe-pm/lappe-linter on branch feat/monorepo. Execute tasks F00-T1 through F00-T8 from feature-00-fork-and-monorepo.md. Hard constraints: preserve upstream relative paths for every moved rule file; do not change any rule's behavior; the existing jest suite must pass with only import-path edits; packages/core must compile and run under plain Node with no obsidian module resolvable. Use the seeded commit subjects verbatim. Stop and report if any rule requires the Obsidian App beyond the conflict-disable callbacks; do not invent additional adapter surface.
```

## Dependencies
None. All other features depend on this one.

## Backlinks
[[README]] | [[project-tracker]]
