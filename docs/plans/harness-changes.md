---
domain: development
category: obsidian-linter-fork
sub-category: harness-executable
date-created: 2026-07-09
date-revised: 2026-07-09
status: pending
aliases:
  - harness changes
tags:
  - harness
  - executable
  - session-data
---
# harness-changes

## Purpose
Executable change specifications for repos outside the linter fork: harness, .claude configuration, session-data, and the product-management plugin. Run each section as a Claude Code prompt inside the named repo. Sections are ordered; HC-1 through HC-3 apply only after F06 ships, HC-4 after F07, HC-5 when the product-intent rule planning starts. Each section carries its own seeded commit message. Backlinks: [[README]] | [[project-tracker]].

## HC-1 harness: register repo in pointer registry and naming convention
Repo: harness. Prompt to execute:
```text
Add klappe-pm/lappe-linter to the pointer-file registry with stable references for: linter.yaml (vault root config contract), packages/cli JSON output contract (output-version 1), and docs/passoffs/. Register the repo under naming convention v2.0.0. Update check-pointer-integrity.sh coverage to include the new registry entries. Do not modify any other registry entries.
```
Commit: `feat(registry): register obsidian-linter pointers and naming v2.0.0 entry`.

## HC-2 .claude: PostToolUse lint hook
Repo: .claude configuration (global settings). Prompt to execute:
```text
Add a PostToolUse hook matching Write and Edit tool calls where file_path ends in .md and is under the tasks vault root or a registered repo docs path. The hook runs lint-on-write.sh from the obsidian-linter repo, which invokes linter-cli fix --json --config <vault>/linter.yaml on the written file and appends JSON output to the session-data spool at the path defined in HC-4. Fail open: nonzero hook exit must not block the tool call; log to the standard hook log. Verify hook latency stays under 400 ms p95 using the bundled single-file CLI build, not the workspace binary.
```
Commit: `feat(hooks): lint-on-write PostToolUse hook for markdown writes`.

## HC-3 .claude: /pass and /resume command updates
Repo: .claude commands. Prompt to execute:
```text
Patch pass.md: after passoff authoring and before commit, add a step that, when the repo contains project-tracker.md, updates the task table rows for the feature worked this session (status transitions only, never renumber IDs) and appends one dated line to the Log section. Patch resume.md: after reading the latest passoff, if project-tracker.md exists, read the section for the assigned feature and load its open tasks as the work queue. Preserve all existing pass and resume behavior; these are additive steps.
```
Commit: `feat(commands): pass and resume maintain project-tracker task state`.

## HC-4 session-data: lint_events ingestion
Repo: session-data. Prompt to execute:
```text
Add a lint_events table (ts, session_id, path, profile, rule, fixed, message, output_version) with a migration. Add an ingestion script that tails or batch-imports the lint spool file of JSON lines emitted by lint-on-write.sh, idempotent on replay via a content hash unique constraint. Add one Datasette view: lint violations by rule and by path over time. Follow the repo's existing ingestion patterns; do not introduce a new scheduler mechanism.
```
Commit: `feat(ingestion): lint_events table, spool ingestion, and datasette view`.

## HC-5 product-management plugin: provider stub
Repo: the product-management plugin (Discovery Tree lineage). Prompt to execute:
```text
Add a linter provider stub implementing RuleProvider api-version 1 from obsidian-linter feature-08: register via registerLinterProvider on plugin load when the linter plugin is present, degrade silently when absent. Contribute note-type schemas for project, feature, epic, and task aligned to the product backbone (OST and GIST) frontmatter, and one placeholder validate rule asserting epic notes carry parent-project. Product-intent rules beyond the placeholder are out of scope pending Kevin's separate planning; leave a TODO block referencing that plan.
```
Commit: `feat(linter): rule provider stub against linter api-version 1`.

## HC-6 harness: pre-commit gate for participating repos
Repos: each repo opting into lint enforcement. Prompt to execute:
```text
Add linter-cli check --changed to the pre-commit hook chain after check-pointer-integrity.sh. Fail closed: violations block the commit and print the check output. Use the single-file CLI bundle path from the pointer registry, not a relative path. Add a documented LINTER_SKIP=1 escape hatch for emergency commits.
```
Commit: `feat(hooks): pre-commit lint gate with documented escape hatch`.
