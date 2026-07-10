---
domain: development
category: obsidian-linter-fork
sub-category: feature
date-created: 2026-07-09
date-revised: 2026-07-09
dependencies: F00, F01, F02
feature-id: F06
pr-count: 2
status: planned
aliases:
  - headless cli
tags:
  - feature
  - cli
---
# feature-06-headless-cli

## Feature name
Headless CLI: `linter-cli`.

## Objective
The token-offload delivery vehicle. A Node CLI in `packages/cli` running the identical core rules and scope resolution against files on disk, callable from Claude Code hooks, pre-commit, and CI, so formatting never re-enters an LLM session.

## Components
Commands: `linter-cli check <paths...>` (report, exit 1 on violations), `linter-cli fix <paths...>` (apply, exit 0 on success, prints changed-file list), `linter-cli fix --stdin` (filter mode for hook pipelines), `linter-cli explain <path>` (prints resolved profile and rule set, the CLI twin of the plugin inspector). Flags: `--config <path>` (default: nearest `linter.yaml` walking up from the target), `--json` (structured violation output for session-data ingestion), `--allow-rename` (enables F04 rename mode), `--changed` (git-diff-scoped runs). Config discovery shared with plugin via core loader. Output contract: `--json` emits one object per file with `path`, `profile`, `violations[] {rule, line, message, fixed}`, `renamed_to`, stable schema versioned `output-version: 1` for SQLite ingestion by session-data.

## Requirements
R1: Byte-identical transforms to the plugin for the same file and config, proven by a parity test harness running both code paths over the fixture corpus. R2: No obsidian import anywhere in the CLI dependency graph. R3: Cold start under 300 ms for single-file fix (measured; matters because hooks run per write). R4: Exit codes: 0 clean or fixed, 1 violations in check mode, 2 config or usage error. R5: `--json` schema documented and versioned; breaking changes bump output-version. R6: Distributed as an npm workspace binary plus a bundled single-file build for hook installation without node_modules.

## Tests
Parity suite (plugin runner vs CLI over all fixtures). Exit code matrix. JSON schema snapshot test. Startup time budget test in CI. `--changed` behavior against a scripted git fixture repo.

## Tasks
| ID | Task | Status |
| --- | --- | --- |
| F06-T1 | CLI scaffold, arg parsing, config discovery | planned |
| F06-T2 | check and fix commands over core runner | planned |
| F06-T3 | stdin filter mode | planned |
| F06-T4 | explain command | planned |
| F06-T5 | json output contract, output-version 1 | planned |
| F06-T6 | changed-files git scoping | planned |
| F06-T7 | single-file bundle build | planned |
| F06-T8 | parity and performance suites | planned |

## PR breakpoints and seeded commits
PR 1 (commands): `feat(cli): check, fix, and explain commands over shared core`, `feat(cli): stdin filter and config discovery`, `test(cli): exit code matrix`. PR 2 (contracts): `feat(cli): versioned json violation output for session-data ingestion`, `feat(cli): git-changed scoping and single-file bundle`, `test(cli): plugin parity and startup budget`.

## Agent prompt
```text
Implement feature-06-headless-cli.md tasks F06-T1 through F06-T8 in packages/cli. The CLI must produce byte-identical output to the plugin path for identical inputs; build the parity test first and keep it green. Exit codes: 0 clean or fixed, 1 check violations, 2 config or usage error. The --json schema in the feature file is a contract; snapshot-test it and version it. Keep cold start under 300 ms for a single-file fix; if a dependency threatens that budget, replace it and note the decision.
```

## Dependencies
[[feature-00-fork-and-monorepo]] | [[feature-01-control-plane]] | [[feature-02-scope-engine]].

## Backlinks
[[README]] | [[project-tracker]]
