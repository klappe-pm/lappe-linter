---
domain: development
category: obsidian-linter-fork
sub-category: feature
date-created: 2026-07-09
date-revised: 2026-07-09
dependencies: F06
feature-id: F07
pr-count: 1
status: planned
aliases:
  - harness integration
tags:
  - feature
  - harness
  - session-data
---
# feature-07-harness-integration

## Feature name
Harness, .claude, and session-data integration.

## Objective
Wire `linter-cli` into the harness so every markdown write by an agent is linted locally: PostToolUse hooks in `.claude` settings, pre-commit enforcement alongside `check-pointer-integrity.sh`, `/pass` and `/resume` command updates that maintain [[project-tracker]], and violation-event ingestion into the session-data SQLite pipeline so lint activity is observable in Datasette.

## Components
Hook script `lint-on-write.sh` (receives the hook payload, extracts the written path, runs `linter-cli fix --json`, appends the JSON line to a spool file for session-data). `.claude/settings` PostToolUse matcher for Write and Edit on `*.md` within vault and repo doc paths. Pre-commit addition: `linter-cli check --changed` gating commits in participating repos. Command updates: `/pass` gains a step that syncs the current feature's task table in [[project-tracker]]; `/resume` gains a read of [[project-tracker]] scoped to the assigned feature. session-data: ingestion script mapping output-version 1 JSON to a `lint_events` table (columns: ts, session-id, path, profile, rule, fixed, message), plus one Datasette view. Pointer-file registry entry and naming convention v2.0.0 registration for this repo. The exact edits are specified as executables in [[harness-changes]]; this feature builds the repo-side artifacts those executables install.

## Requirements
R1: The hook is fail-open for sessions (a lint crash never blocks the agent write; it logs) but pre-commit is fail-closed. R2: Hook adds under 400 ms p95 per write, measured with the F06 startup budget. R3: Spool ingestion is idempotent on replay. R4: Hook scripts run on macOS BSD userland and Ubuntu CI without modification. R5: No secrets in any hook or config artifact.

## Tests
Hook payload fixture test on macOS and Ubuntu CI runners. Spool replay idempotency test. Pre-commit rejection test with a violating fixture. lint_events schema migration test.

## Tasks
| ID | Task | Status |
| --- | --- | --- |
| F07-T1 | lint-on-write.sh hook script, BSD and GNU compatible | planned |
| F07-T2 | PostToolUse matcher config artifact | planned |
| F07-T3 | Pre-commit check --changed integration | planned |
| F07-T4 | session-data lint_events ingestion and Datasette view | planned |
| F07-T5 | /pass and /resume command file patches | planned |
| F07-T6 | Pointer registry and naming registration artifacts | planned |

## PR breakpoints and seeded commits
Single PR in this repo: `feat(repo): lint-on-write hook, pre-commit gate, and session-data ingestion artifacts`, `docs(repo): harness installation via harness-changes executables`, `test(repo): hook portability and spool idempotency`. Corresponding harness-repo commits are seeded inside [[harness-changes]].

## Agent prompt
```text
Implement feature-07-harness-integration.md tasks F07-T1 through F07-T6. Constraints: session hooks fail open, pre-commit fails closed; scripts must run unmodified under macOS BSD userland and Ubuntu (no GNU-only flags, sed -i requires the '' form guarded by OS detection or use a portable idiom); spool ingestion idempotent on replay; nothing here edits the harness repo directly, it produces the artifacts that harness-changes.md installs. Measure hook latency against the 400 ms p95 budget and report the number.
```

## Dependencies
[[feature-06-headless-cli]].

## Backlinks
[[README]] | [[project-tracker]]
