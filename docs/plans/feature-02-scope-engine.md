---
domain: development
category: obsidian-linter-fork
sub-category: feature
date-created: 2026-07-09
date-revised: 2026-07-09
dependencies: F00, F01
feature-id: F02
pr-count: 2
status: planned
aliases:
  - scope engine
tags:
  - feature
  - core
---
# feature-02-scope-engine

## Feature name
Scope engine: profile resolution per file.

## Objective
Fine-grained linting control by file type, folder, subfolder, and note type (project, feature, epic, task, or any frontmatter-defined type). A profile is a named partial rule configuration plus matchers; the engine resolves exactly one merged configuration per file before the rules runner executes.

## Components
Matcher types in core: `path` (globs, picomatch), `extension`, `frontmatter` (key-value predicates against parsed YAML, supporting exact and list-contains), `tag`. Resolver: computes matching profiles, orders them, deep-merges rule options over `defaults`. Runner integration: one call site change in `rules-runner.ts` where global settings are read, replaced by the resolved config. Plugin surface: a "which profile applies" command showing the resolved profile chain for the active file. CLI surface arrives with F06 unchanged, because resolution lives in core.

## Precedence
Explicit per-note override key in frontmatter (`linter-profile: name`) wins. Then frontmatter matchers, then deepest matching path glob, then extension, then defaults. Ties within a level resolve by declaration order in `linter.yaml`. Merge is additive: later-resolved profiles override earlier ones key by key; `enabled: false` in a profile disables a rule for that scope regardless of defaults.

## Requirements
R1: Resolution is pure and synchronous given (path, frontmatter text, config); no vault access inside core. R2: Resolution cost under 1 ms per file for a config with 50 profiles (memoized compiled matchers). R3: Existing per-note `disabled rules` YAML key keeps working and applies after profile merge. R4: The upstream global settings path becomes the `defaults` profile; behavior with zero profiles defined is byte-identical to upstream. R5: Deterministic: same inputs, same merged config, property-tested.

## Tests
Table-driven resolver tests covering every precedence rank and tie-break. Golden test: zero-profile config output equals upstream runner output across the upstream example corpus. Property test for determinism and merge associativity.

## Tasks
| ID | Task | Status |
| --- | --- | --- |
| F02-T1 | Matcher types and compiled matcher cache | planned |
| F02-T2 | Resolver with precedence and deep merge | planned |
| F02-T3 | Integrate resolver into rules-runner call site | planned |
| F02-T4 | Frontmatter predicate parser (exact, list-contains) | planned |
| F02-T5 | linter-profile override key | planned |
| F02-T6 | Plugin command: show resolved profile for active file | planned |
| F02-T7 | Golden and property test suites | planned |

## PR breakpoints and seeded commits
PR 1 (resolver): `feat(core): scope matchers and profile resolver with precedence merge`, `test(core): resolver precedence table and determinism property tests`. PR 2 (integration): `feat(core): rules runner consumes resolved profile config`, `feat(plugin): resolved-profile inspector command`, `test(core): golden parity with upstream on zero-profile config`.

## Agent prompt
```text
Implement feature-02-scope-engine.md tasks F02-T1 through F02-T7. Precedence: linter-profile frontmatter override, then frontmatter matchers, then deepest path glob, then extension, then defaults; ties by declaration order. Resolution must be a pure function in packages/core with no obsidian import and no filesystem access. With no profiles defined, output must be byte-identical to upstream behavior; prove it with a golden test over the upstream examples. Do not add UI beyond the single inspector command.
```

## Dependencies
[[feature-00-fork-and-monorepo]] | [[feature-01-control-plane]].

## Backlinks
[[README]] | [[project-tracker]]
