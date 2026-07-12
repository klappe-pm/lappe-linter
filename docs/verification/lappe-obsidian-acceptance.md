# Lappe Linter Obsidian acceptance record

This record is required before calling a build shippable. It must describe the exact installed artifact and a fresh or disposable vault; unit tests and a static preview do not replace this record.

## Artifact

- Date/time:
- Vault path:
- Plugin id: `lappe-linter`
- Plugin version:
- Installed `main.js` path:
- Installed `main.js` SHA-256:
- Verification command: `scripts/verify-test-vault.sh <vault-path>`
- Obsidian version:
- Reload performed after installation: yes / no

## Goal

From a fresh vault, configure and observe the requested Lappe Linter behavior in the real Obsidian UI: exact settings tabs, YAML controls, Headers/Body/Special formatting, scopes and inheritance, a real workspace preview, and the wand lint action in both editing and reading views.

## Settings navigation

- [ ] General
- [ ] YAML
- [ ] Headers
- [ ] Body
- [ ] Special formatting
- [ ] Scopes
- [ ] Rule order
- [ ] Custom
- [ ] Debug
- [ ] No `Lappe` tab
- [ ] No `Style` tab

## YAML

- [ ] Default order is visible as preset, domain, category, sub-category, types, date-created, date-revised, links, aliases, tags, blank row.
- [ ] Rows drag to reorder and the keyboard fallback works.
- [ ] Key and value suggestions are sourced from vault metadata and narrow as text is entered.
- [ ] Add and remove row behavior is consistent.
- [ ] Blank line after YAML is retained.
- [ ] Array values dedupe.
- [ ] Remove YAML keys/values works.
- [ ] `date-created` and `date-revised` behavior is confirmed.
- [ ] Removed title/footnote controls are absent.

## Headers, Body, and Special formatting

- [ ] H1-H6 options include camelCase, First letter, kebab-case, Title Case, and underscore_formatted.
- [ ] Real filename flow ignores Untitled, then formats the real filename and sets the first H1; H2/H3 behavior is confirmed.
- [ ] Header increment, heading start line, and trailing spaces defaults are confirmed ON.
- [ ] Body exposes paragraph spacing 0/1/2 and bullet marker `-` / `*`.
- [ ] Artificial line-break removal preserves code, quotes, tables, and callouts.
- [ ] Bold, underscore, and italic controls are present.
- [ ] Special formatting controls cover code, quotes, tables, and callouts.

## Preview

- [ ] Preview opens as a non-blocking workspace view, not a modal.
- [ ] The left pane renders a real Markdown note with YAML, H1-H3, paragraphs, bullets, emphasis, code, quotes, tables, and callouts.
- [ ] The right pane shows the effective settings/profile summary.
- [ ] Changing `linter.yaml` updates the view without closing it.
- [ ] The rendered output changes when a relevant setting changes.

## Scopes and inheritance

- [ ] Scope selector supports folder, file, path, properties, tags, backlinks, aliases, domain, category, sub-category, date-created, date-revised, age, project, and types.
- [ ] Multiple scope types combine with AND semantics; values within a type use OR semantics.
- [ ] Scope fields offer vault-backed suggestions and still allow new values.
- [ ] Age uses today minus date-created in five-day buckets; today is `1-5`.
- [ ] Base settings propagate to non-overridden profile values.
- [ ] An explicit profile override remains unchanged by base edits.
- [ ] Push-template-defaults relinks redundant overrides.
- [ ] Metadata matching is confirmed for preset fields, tags, aliases, and links/backlinks.

## Wand and persistence

- [ ] Wand lints an active Markdown file in editing view.
- [ ] Wand lints the active Markdown file in reading view.
- [ ] Wand shows a Notice when no Markdown file is active.
- [ ] Reload after `linter.yaml` changes preserves the chosen settings.
- [ ] Before/after note content is attached to this record or the PR.

## Result

- Overall result: PASS / FAIL
- Failed checks and reproduction:
- Follow-up issue/plan:
- Reviewer:
