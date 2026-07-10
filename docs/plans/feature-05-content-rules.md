---
domain: development
category: obsidian-linter-fork
sub-category: feature
date-created: 2026-07-09
date-revised: 2026-07-09
dependencies: F00, F02
feature-id: F05
pr-count: 1
status: planned
aliases:
  - content rules
tags:
  - feature
  - style-guide
---
# feature-05-content-rules

## Feature name
Content rules: style-guide transforms.

## Objective
Encode the Average Intelligence writing conventions as deterministic rules so no session token is ever spent on them: join mid-paragraph line breaks, strip bold, replace em dashes, normalize underscore emphasis, and collapse prose bullet lists where scoped.

## Components
New core rules, each with the standard ignore-types guards (code fences, math, YAML, tables, wikilinks): `join-paragraph-lines` (unwrap hard-wrapped prose lines within a paragraph into single lines; never touches lists, blockquotes, tables, headings, or fenced blocks); `strip-strong` (remove `**` and `__` emphasis, keeping inner text; option `keep-heading-strong: false`); `replace-em-dash` (em and en dash to a configured replacement, default comma plus space with whitespace normalization; option map for word-joining dashes to hyphen); `prose-list-to-sentences` (report-only by default, optional fix that converts simple one-level bullet lists into comma-joined prose sentences, scoped to prose note types only, never task or tracker notes). Underscore emphasis normalization is configuration, not code: enable upstream emphasis-style and strong-style set to asterisk in defaults, documented in `linter.yaml`.

## Requirements
R1: Every rule idempotent and covered by the upstream Example mechanism so docs generate. R2: `join-paragraph-lines` treats a line ending in two trailing spaces or `<br>` as an intentional break and preserves it. R3: `replace-em-dash` never edits inside code, math, URLs, or YAML. R4: `prose-list-to-sentences` ships report-only; destructive mode requires explicit per-profile opt-in. R5: All four rules are profile-scopable with zero global default enablement, so upstream parity holds.

## Tests
Example-driven tests per rule (the upstream pattern), plus adversarial fixtures: nested lists adjacent to paragraphs, code fences containing dashes and bold markers, frontmatter containing double asterisks, table cells with hard-wrapped intent.

## Tasks
| ID | Task | Status |
| --- | --- | --- |
| F05-T1 | join-paragraph-lines rule | planned |
| F05-T2 | strip-strong rule | planned |
| F05-T3 | replace-em-dash rule | planned |
| F05-T4 | prose-list-to-sentences rule, report-only default | planned |
| F05-T5 | Default linter.yaml stanza for emphasis and strong style | planned |
| F05-T6 | Adversarial fixture suite | planned |

## PR breakpoints and seeded commits
Single PR: `feat(core): style-guide rules for paragraph joining, strong stripping, and dash replacement`, `feat(core): prose-list-to-sentences report rule`, `test(core): adversarial fixtures for style-guide rules`.

## Agent prompt
```text
Implement feature-05-content-rules.md tasks F05-T1 through F05-T6 as upstream-pattern rules in packages/core with Example-based tests. Non-negotiables: ignore-types guards on code, math, YAML, tables, and wikilinks; idempotency; zero rules enabled in compiled defaults; intentional line breaks (trailing double space, <br>) preserved by join-paragraph-lines; prose-list-to-sentences fixes nothing unless a profile opts in. Use the existing IgnoreType machinery, do not write custom masking.
```

## Dependencies
[[feature-00-fork-and-monorepo]] | [[feature-02-scope-engine]].

## Backlinks
[[README]] | [[project-tracker]]
