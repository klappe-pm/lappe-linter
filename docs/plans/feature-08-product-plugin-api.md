---
domain: development
category: obsidian-linter-fork
sub-category: feature
date-created: 2026-07-09
date-revised: 2026-07-09
dependencies: F02, F03
feature-id: F08
pr-count: 1
status: planned
aliases:
  - product plugin api
tags:
  - feature
  - integration
  - product-management
---
# feature-08-product-plugin-api

## Feature name
Extension API for the product-management plugin.

## Objective
An extension surface so the product-management plugin (Discovery Tree and the OST and GIST product backbone work) can contribute note-type schemas and product-intent rules (for project, feature, epic, and task notes) without forking the linter again. Kevin plans the product-intent rules separately; this feature ships the contract they plug into.

## Components
Core: `RuleProvider` interface (`id`, `rules(): Rule[]`, `noteTypes(): NoteTypeSchema[]`, `configNamespace`) and a provider registry merged after `linter.yaml` load, with file config winning conflicts. Plugin: registration bridge over the Obsidian plugin API (`app.plugins`), a documented `registerLinterProvider` entry point with version negotiation (`api-version: 1`), and graceful degradation when either plugin is absent. CLI: `--provider <module>` flag loading a provider as a Node module so the same product rules run headless. Config: provider rules configure under `providers.<namespace>` in `linter.yaml`, fully scope-resolvable by F02. Documentation: a provider authoring guide with a worked example provider (`example-product-provider`) validating epic notes for a required `parent-project` key, kept in-repo as the integration test fixture.

## Requirements
R1: Provider rules are indistinguishable from built-ins to the resolver, runner, and CLI. R2: API versioned; mismatch logs and skips the provider, never crashes lint. R3: Provider registration order cannot change built-in behavior when no provider config is present. R4: The worked example doubles as the compatibility test the product-management plugin builds against. R5: No linter release may break api-version 1 without a major version bump.

## Tests
Example-provider integration test through plugin path and CLI `--provider` path. Version mismatch degradation test. Conflict test: provider default vs linter.yaml override, file wins.

## Tasks
| ID | Task | Status |
| --- | --- | --- |
| F08-T1 | RuleProvider interface and registry in core | planned |
| F08-T2 | Plugin registration bridge with api-version negotiation | planned |
| F08-T3 | CLI --provider module loading | planned |
| F08-T4 | providers config namespace in linter.yaml schema | planned |
| F08-T5 | example-product-provider and authoring guide | planned |

## PR breakpoints and seeded commits
Single PR: `feat(core): rule provider registry with versioned api`, `feat(plugin): registerLinterProvider bridge`, `feat(cli): --provider module loading`, `docs(repo): provider authoring guide with example product provider`.

## Agent prompt
```text
Implement feature-08-product-plugin-api.md tasks F08-T1 through F08-T5. The contract is the deliverable: RuleProvider api-version 1 must let an external Obsidian plugin contribute rules and note-type schemas that behave identically to built-ins across plugin and CLI paths. Mismatched versions degrade gracefully with a logged skip. linter.yaml always wins config conflicts. Ship the example provider as a real workspace package used by the integration tests; the product-management plugin will build against it.
```

## Dependencies
[[feature-02-scope-engine]] | [[feature-03-note-type-frontmatter]].

## Backlinks
[[README]] | [[project-tracker]]
