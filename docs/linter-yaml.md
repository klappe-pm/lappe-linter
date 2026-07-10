---
domain: development
category: obsidian-linter-fork
sub-category: documentation
date-created: 2026-07-10
date-revised: 2026-07-10
status: DRAFT
aliases:
  - linter.yaml reference
tags:
  - documentation
  - config
---
# linter-yaml

## Overview

`linter.yaml` at the vault root is the control plane for lappe-linter: the single git-tracked source of truth for rule configuration, scoped profiles, and note-type schemas. `lappe-linter.yaml` is an accepted alias; when both exist, `linter.yaml` wins. An invalid file fails closed: scoped linting disables with one notice instead of applying a partial config. When no file exists, the compiled defaults (dec-005) are active; create the file from the Lappe settings tab or with `lappe-linter init`.

`packages/core/src/config/schema.ts` exports a JSON Schema (draft-07) for the file, usable for editor validation via yaml-language-server or VS Code.

## version

The config schema version. Only `1` is valid.

```yaml
version: 1
```

## defaults

Rules applied to every file. Each key under `rules` is a rule id with an `enabled` flag plus rule-specific options.

```yaml
defaults:
  rules:
    yaml-key-sort:
      enabled: true
      priority-keys: [domain, category, date-created, date-revised]
    h1-matches-stem:
      enabled: true
```

## profiles

Named per-scope overrides. A file matching a profile's `match` block gets the profile's `rules` layered on top of `defaults`. Match kinds: `path` (vault-relative globs), `extension` (without the dot), `frontmatter` (key-value predicates, exact match or list-contains), and `tag`. All kinds present must match; within one kind any listed alternative suffices. A profile with no match block applies only via an explicit `linter-profile` frontmatter key.

```yaml
profiles:
  tasks:
    match:
      path: [tasks/**]
      frontmatter: {category: task}
    rules:
      kebab-case-filename:
        enabled: false
```

## note-types

Frontmatter schemas per note type: `required` keys with defaults inserted when absent, `key-order`, allowed `values` per key, managed `date-keys`, and a `match` block binding files to the type.

```yaml
note-types:
  task:
    match:
      frontmatter: {type: task}
    required:
      status: NEW
    key-order: [domain, category, status]
    values:
      status: [NEW, DRAFT, INPRG, REVIEW, DONE, ARCHIVED]
    date-keys:
      created: date-created
      revised: date-revised
```

## rename

Filename rule behavior: `off` disables it, `flag` reports only, `rename` fixes filenames and updates links.

```yaml
rename:
  mode: flag
```

## ignore

Vault-relative folders and files the linter never touches.

```yaml
ignore:
  folders: [templates, .obsidian]
  files: [inbox/scratch.md]
```

## providers

Configuration namespaces for provider-contributed rules (see `packages/core/src/providers/authoring-guide.md`). Each namespace mirrors the `defaults.rules` shape; the file always wins a conflict with provider defaults.

```yaml
providers:
  product:
    rules:
      epic-requires-parent-project:
        enabled: false
```

## Precedence

For each file, `defaults.rules` applies first, then every matching profile in ascending specificity: frontmatter and tag matches outrank path matches, which outrank extension matches; among path matches, deeper globs outrank shallower ones. The last (most specific) writer wins per rule option. An explicit `linter-profile` frontmatter key applies that profile above everything else.

## Styles Folder

Files in `linter-styles/*.yaml` next to `linter.yaml` merge as named profile fragments: one file equals one profile named after the file, merged in name order, with `linter.yaml` winning name conflicts. Styles currently apply inside Obsidian only; the CLI does not read the folder yet.
