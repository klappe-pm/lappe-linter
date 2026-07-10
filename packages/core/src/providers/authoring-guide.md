---
domain: development
category: obsidian-linter-fork
sub-category: documentation
date-created: 2026-07-10
date-revised: 2026-07-10
status: DRAFT
aliases:
  - provider authoring guide
tags:
  - documentation
  - provider-api
---
# authoring-guide

## Two Ways to Add a Rule

Add a rule directly to core when it is general-purpose markdown hygiene that every vault wants: write a `CoreRule` under the matching `packages/core/src/` area (`rules-content/` for markdown transforms, `note-types/` for frontmatter schema rules, `filename/` for naming rules), register it from that area's barrel, or run `lappe-linter new-rule <name>` to scaffold the rule, its test, and its registration under `packages/core/src/rules-custom/`; then configure it under `defaults.rules` or a profile in `linter.yaml`. Ship a provider when the rules belong to another product surface (the product-management plugin, a client vault, an experiment) and must evolve without forking or re-releasing the linter. The provider path is the no-fork extension path: your package depends on `@lappe-linter/core`, contributes rules and note-type schemas at runtime, and the linter treats them exactly like built-ins.

## Writing a Provider

Implement `RuleProvider` from `@lappe-linter/core` (`packages/core/src/providers/provider.ts`):

```ts
import {registerProvider, RuleProvider} from '@lappe-linter/core';

const myProvider: RuleProvider = {
  id: 'my-product',
  apiVersion: 1,
  configNamespace: 'product',
  rules: () => [/* CoreRule objects with bare kebab-case ids */],
  noteTypes: () => ({/* name: NoteTypeSchema */}),
};

const result = registerProvider(myProvider);
```

Rules stay pure: `(text, options, ctx) => string`, no Obsidian imports, no filesystem access, idempotent on the second run. Report-only rules set `reportOnly: true` and return any text different from the input to flag a violation; the runner records the violation and discards the returned text.

## What Registration Does

- Your rules land in the core registry with ids prefixed `<configNamespace>/`, so `epic-requires-parent-project` becomes `product/epic-requires-parent-project` and can never collide with a built-in.
- Your note-type schemas merge into the provider note-types view (`getProviderNoteTypes()`); first definition of a name wins.
- `registerProvider` never throws. A wrong `apiVersion`, a duplicate id or namespace, or a provider that throws mid-registration logs a `console.warn` and returns `{ok: false, reason}`; the lint run continues without you.

## Configuration and Precedence

Users configure your rules in `linter.yaml` under your namespace:

```yaml
providers:
  product:
    rules:
      epic-requires-parent-project:
        enabled: false
```

Call `mergeProviderConfig(config)` after the config loads. It materializes each provider rule into `defaults.rules` under the prefixed id, seeded from the provider defaults (`enabled: true` plus the rule's `defaultOptions`), then overlaid by the file stanza. The file always wins a conflict, key by key, and an explicit `defaults.rules["product/epic-requires-parent-project"]` stanza in the file wins over everything. From there the scope engine resolves your rules exactly like built-ins.

## Worked Example

`example-product-provider.ts` in this directory is the living reference: note-type schemas for `project`, `epic`, `feature`, and `task` carrying the product-backbone parent keys, plus one report-only rule flagging epic notes that lack `parent-project`. Its tests in `packages/core/__tests__/providers/` double as the api-version 1 compatibility suite; a change that breaks them is a breaking API change and requires a major version bump.
