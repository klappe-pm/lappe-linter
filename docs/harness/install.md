---
domain: development
category: obsidian-linter-fork
sub-category: harness-install
date-created: 2026-07-10
date-revised: 2026-07-10
status: pending
aliases:
  - harness install
tags:
  - harness
  - install
  - session-data
---
# install

## Purpose

Installation guide for the F07 repo-side artifacts under `scripts/harness/`. Each section maps to one executable in [[harness-changes]] (HC-1 through HC-6), states which repo the executable runs in, and names the artifact from this repo it installs or adapts. This repo ships the artifacts; the HC executables perform the installs. Nothing in this repo edits the harness repo, `~/.claude`, or session-data directly.

## Fail-Open and Fail-Closed Split

Session-side hooks fail open: `lint-on-write.sh` exits 0 on every error path (missing CLI, missing config, CLI crash, malformed payload, spool write failure) and logs the failure to stderr, so a lint problem never blocks an agent write. Commit-side enforcement fails closed: `pre-commit-lint.sh` propagates any nonzero CLI exit, blocking the commit until violations are fixed or the documented `LINTER_SKIP=1` escape hatch is used. Ingestion is offline and idempotent, so a replayed spool never double-counts.

| Surface | Script | Failure mode |
| --- | --- | --- |
| PostToolUse hook | `scripts/harness/lint-on-write.sh` | fail open, exit 0 always |
| Pre-commit gate | `scripts/harness/pre-commit-lint.sh` | fail closed, nonzero blocks |
| Spool ingestion | `scripts/harness/ingest-lint-spool.py` | idempotent replay, skips malformed lines |

## HC-1 harness: pointer registry and naming registration

Runs in: the harness repo. Execute the HC-1 prompt from [[harness-changes]] there. It registers this repo (`klappe-pm/lappe-linter`) in the pointer-file registry with stable references for the `linter.yaml` config contract, the `packages/cli` JSON output contract (`output-version` 1), and `docs/passoffs/`, and registers the repo under naming convention v2.0.0. No artifact from `scripts/harness/` is copied; the registry entries point back at this repo's paths, and HC-6 later resolves the CLI bundle path through them.

## HC-2 .claude: PostToolUse lint hook

Runs in: the `~/.claude` configuration. Execute the HC-2 prompt from [[harness-changes]] there. Installation is a paste of `scripts/harness/settings-posttooluse-snippet.json` into the `hooks` block of the target settings file (merge the `PostToolUse` array if one already exists). The snippet matches `Write|Edit` with a 10 second timeout and points at `scripts/harness/lint-on-write.sh` in this repo's clone; adjust the absolute path if the clone lives elsewhere.

The hook reads the PostToolUse payload on stdin, extracts `tool_input.file_path` with `python3` (no `jq` dependency), and exits 0 silently unless the path ends in `.md`, the file exists, and a `linter.yaml` is found walking up from the file (the participating-vault test). It then runs `lappe-linter fix --json --config <resolved linter.yaml> <file>`, annotates each output line with `session_id` (from the payload) and `ts` (UTC), and appends the lines to the spool at `$LINT_SPOOL` (default `~/.claude/telemetry/lint-spool.jsonl`). Set `LAPPE_LINTER_BIN` if the bundled single-file CLI is not on `PATH`. Fail open per the table above; script overhead measured at 85 ms mean on Apple Silicon with a stub CLI, leaving the F06 300 ms CLI cold-start budget inside the 400 ms p95 hook budget.

## HC-3 .claude: /pass and /resume command patches

Runs in: the `~/.claude` commands. The patch executables live in [[harness-changes]] section HC-3 and are not duplicated here; this repo ships no artifact for HC-3. Execute that prompt to add the [[project-tracker]] sync step to `/pass` and the tracker-scoped work-queue read to `/resume`.

## HC-4 session-data: lint_events ingestion

Runs in: the session-data repo. Execute the HC-4 prompt from [[harness-changes]] there. The artifact it adapts is `scripts/harness/ingest-lint-spool.py`: a python3 stdlib-only batch importer taking the sqlite db path as argument 1 and the spool path as optional argument 2 (default `~/.claude/telemetry/lint-spool.jsonl`). It creates the `lint_events` table if absent with columns `ts, session_id, path, profile, rule, fixed, message, output_version, content_hash TEXT UNIQUE`, inserts one row per violation, and is idempotent on replay: each row's `content_hash` derives from the sha256 of the raw spool line plus the violation index, inserted with `INSERT OR IGNORE`. The HC-4 executable ports this into the repo's existing migration and ingestion patterns and adds the Datasette view (violations by rule and by path over time); the view itself is session-data work, not a file in this repo.

## HC-5 product-management plugin: provider stub

Runs in: the product-management plugin repo. F07 ships no artifact for HC-5; the RuleProvider contract it codes against is [[feature-08-product-plugin-api]] work. Listed here only to keep the HC sequence complete.

## HC-6 harness: pre-commit gate for participating repos

Runs in: each repo opting into lint enforcement. Execute the HC-6 prompt from [[harness-changes]] there. The artifact installed is `scripts/harness/pre-commit-lint.sh`, chained after `check-pointer-integrity.sh` in the pre-commit hook. It runs `lappe-linter check --changed` and fails closed: violations (exit 1), config errors (exit 2), and a missing CLI all block the commit and print the check output. Emergency bypass: `LINTER_SKIP=1 git commit ...` skips the gate for that one commit with a stderr notice. Resolve the CLI through the HC-1 pointer registry bundle path via `LAPPE_LINTER_BIN`, not a relative path.

## Verification

Run `bash scripts/harness/tests/run.sh` from the repo root. The suite fakes `lappe-linter` with a PATH shim, so it passes without the real CLI: hook happy path and every fail-open branch, spool annotation, ingestion replay idempotency, and the pre-commit skip, block, and missing-CLI cases.

## Backlinks

[[harness-changes]] | [[feature-07-harness-integration]] | [[project-tracker]]
