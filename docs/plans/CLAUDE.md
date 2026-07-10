---
domain: development
category: obsidian-linter-fork
sub-category: agent-instructions
date-created: 2026-07-09
date-revised: 2026-07-09
status: active
aliases:
  - claude instructions
tags:
  - claude-code
  - harness
---
# CLAUDE

## Inheritance
All rules in [[AGENTS]] apply. This file adds Claude Code specifics only.

## Session protocol
On session start, run `/resume`, which reads the latest passoff in `docs/passoffs/` and the task state in [[project-tracker]]. On session end, run `/pass`, which writes the passoff, updates [[project-tracker]] task statuses for the feature worked, commits, and opens the PR per the passoff lifecycle. Do not hand-author passoffs when `/pass` is available.

## Hooks
This repo participates in the harness pointer-file registry and naming convention v2.0.0. `check-pointer-integrity.sh` runs as a pre-commit hook once [[harness-changes]] items are applied. The linter CLI built by [[feature-06-headless-cli]] becomes a PostToolUse hook target for markdown writes; until it ships, do not simulate its behavior by hand-formatting vault files in-session. That defeats the token-offload objective of the project.

## Execution style
Surgical diffs. State assumptions before multi-file changes. Prefer extending the upstream Rule class and registry over parallel abstractions. When a task requires touching upstream code paths (`rules-runner.ts`, `settings-data.ts`, `main.ts`), isolate the change behind a small interface in `core` so upstream merges stay tractable.

## Backlinks
[[README]] | [[project-tracker]]
