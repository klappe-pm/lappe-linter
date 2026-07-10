---
domain: development
category: obsidian-linter-fork
sub-category: planning
date-created: 2026-07-09
date-revised: 2026-07-09
repository: klappe-pm/lappe-linter
status: planned
upstream: platers/obsidian-linter
aliases:
  - linter fork plan
tags:
  - obsidian
  - linter
  - harness
---
# README

## Objective
Fork platers/obsidian-linter, restructure it as a monorepo with a shared rule core, and add a scoped, config-file-driven linting system that enforces the Average Intelligence markdown style guide locally. The economic goal is offload: formatting work that currently consumes Claude Code session tokens moves to deterministic local functions executed by the Obsidian plugin on save and by a headless CLI invoked from harness hooks and CI. Every formatting decision the style guide already settles should cost zero tokens.

## Decisions of record
Repo strategy is a hard fork of upstream with the rule core extracted into a workspace package consumed by both the Obsidian plugin and a Node CLI. Kebab-case filename enforcement ships in both modes, plugin-side rename with link updates and flag-only reporting, selectable per scope behind a setting. The control plane is a `linter.yaml` file at the vault root, git-tracked, and it is the single source of truth; the Obsidian settings UI reads from and writes back to that file, and the plugin's `data.json` is a derived cache only.

## Architecture summary
The fork restructures into npm workspaces: `packages/core` holds every pure `(text, options) => string` rule, the scope engine, the config loader, and the note-type frontmatter schemas; `packages/plugin` holds the Obsidian adapter (vault events, rename with link updates, settings UI synced to `linter.yaml`); `packages/cli` holds the headless runner for hooks and CI. Upstream rules are already pure apply functions registered in a central registry (`src/rules.ts`, `src/rules-registry.ts`), which is what makes extraction feasible. The scope engine inserts ahead of the rules runner: for each file it resolves a profile from path globs, file extension, and frontmatter note type, merges profile options over the default profile, and hands the merged options to the unchanged runner.

## Feature index
Delivery order matches dependency order. Each feature is one PR unless its file says otherwise.

| Order | Feature | File |
| --- | --- | --- |
| 0 | Fork and monorepo restructure | [[feature-00-fork-and-monorepo]] |
| 1 | Control plane (`linter.yaml`) | [[feature-01-control-plane]] |
| 2 | Scope engine | [[feature-02-scope-engine]] |
| 3 | Note-type frontmatter schemas | [[feature-03-note-type-frontmatter]] |
| 4 | Filename and H1 enforcement | [[feature-04-filename-and-h1]] |
| 5 | Content rules (style guide) | [[feature-05-content-rules]] |
| 6 | Headless CLI | [[feature-06-headless-cli]] |
| 7 | Harness integration | [[feature-07-harness-integration]] |
| 8 | Product plugin extension API | [[feature-08-product-plugin-api]] |

## External integrations
Four systems outside this repo consume or feed it. The harness registers the repo in the pointer-file registry and naming convention v2.0.0 and installs the pre-commit gate. The .claude configuration gains a PostToolUse hook running the CLI on every agent markdown write plus /pass and /resume patches that maintain [[project-tracker]]. session-data ingests the CLI's versioned JSON violation output into a lint_events table with a Datasette view, making lint activity observable per session. The product-management plugin integrates through the F08 provider API, contributing product-backbone note-type schemas now and product-intent rules under a separate plan Kevin will author. All cross-repo edits are specified as executables in [[harness-changes]]; nothing in this repo writes to those repos directly.

## Risks
Upstream merge cost rises after the monorepo restructure; mitigation is preserved rule paths plus `git merge -X find-renames=90%` and the standing rule that sync PRs never mix with feature PRs. Double-write contention is possible when the plugin lints on save while the CLI hook fixes the same file mid-session; mitigation is idempotent rules (both writers converge on identical bytes) and the F03 churn guard, with sync clients (iCloud, Obsidian Sync) flagged as the environment to test before enabling rename mode anywhere synced. The rename feature is the only destructive capability; it stays default-flag everywhere until F04's fixture-vault link-integrity suite is green.

## Tracking
Work state lives in [[project-tracker]], updated by every `/pass` and read by every `/resume`. Harness-side changes required by this project are specified as executable instructions in [[harness-changes]].

## Upstream sync policy
Add upstream as a remote (`git remote add upstream https://github.com/platers/obsidian-linter.git`). Rule files keep their upstream relative paths inside `packages/core/src/rules/` so that `git merge upstream/master` conflicts stay localized to moved-file detection. Sync monthly or when upstream ships a rule worth adopting. Never let a sync PR mix with a feature PR.
