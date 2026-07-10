---
domain: development
category: obsidian-linter-fork
sub-category: agent-instructions
date-created: 2026-07-09
date-revised: 2026-07-09
status: active
aliases:
  - codex instructions
tags:
  - codex
  - harness
---
# CODEX

## Inheritance
All rules in [[AGENTS]] apply. This file adds Codex specifics only.

## Assignment shape
Codex receives single-feature assignments referencing one feature file. Read the feature file's Agent Prompt section; it is the task specification. Do not read or modify other features' code except declared dependencies. If a dependency listed in the feature file is not yet merged, stop and report rather than stubbing it.

## Constraints
No network calls at test time; all fixtures are local. Do not modify `docs/passoffs/` or [[project-tracker]]; report completed tasks in the PR body instead, and the maintainer's Claude Code session reconciles the tracker at the next `/pass`. Follow seeded commit messages exactly.

## Backlinks
[[README]] | [[project-tracker]]
