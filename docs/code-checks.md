---
domain: development
category: obsidian-linter-fork
sub-category: documentation
date-created: 2026-07-10
date-revised: 2026-07-10
status: active
aliases:
  - code checks
tags:
  - code-checks
  - security
---
# code-checks

## What This Is

Declarative code linting for the coding projects integrated in your vault. Checks run over fenced code blocks in your notes, scoped by fence language and by path glob, and surface through the same channels as every other rule: the save-time Notice in Obsidian, the Lappe settings tab, and `lappe-linter check` in hooks and CI.

## The Harness Inspiration

The model mirrors how the harness project expresses hooks and checks: deterministic, path-scoped, fail-open for advisory surfaces, and never leaking secrets into logs. Where a harness hook is a script the harness runtime executes, a lappe-linter code check is pure data: a pattern, a scope, and a message. That difference is the security posture.

## Security Posture

- Checks are data, never code. There is no command execution, no eval, no dynamic module loading, and no network access anywhere in the check path.
- Execution is bounded: patterns run line by line, lines over 2000 characters are skipped, and reporting stops after 100 hits per file, so a pathological regex cannot hang the editor or a hook.
- Messages never echo matched text. A token-shaped secret found in a code block is reported by location only, so it cannot travel into Notices, CLI output, or the session-data spool.
- An invalid check (bad regex, wrong types) is skipped with a loader warning; it never fails the config closed, because checks are additive.

## Configuration

Checks live in `linter.yaml` under a top-level `code-checks` section, keyed by check id:

```yaml
code-checks:
  no-token-shaped-strings:
    enabled: true
  my-own-check:
    enabled: true
    description: Flag TODO bombs in shell blocks
    languages: [bash, sh]
    paths: [projects/**]
    pattern: "TODO\\(urgent\\)"
    message: urgent TODO left in a shell block
```

Fields: `pattern` (regex source, required), `languages` (fence languages, absent = all fences), `paths` (vault-relative globs, absent = everywhere), `message` (what the violation says; never include captured text), `flags` (regex flags from `imsu`), and `fix: {replacement}` to make the check a fixing check.

## Built-In Checks

All built-ins ship disabled; enable them in the Lappe tab's Code checks section or in `linter.yaml`.

- `no-token-shaped-strings`: cloud keys, bearer tokens, JWTs, and long hex literals in any code block. Report only; the match itself is never printed.
- `no-gnu-only-flags-in-sh`: GNU-only shell idioms that break on macOS BSD userland (`sed -i` without the `''` arg, `readlink -f`, `flock`, bare `timeout`), in `sh`/`bash`/`zsh`/`shell` fences.
- `no-trailing-whitespace-in-code`: strips trailing whitespace on lines inside code blocks; the worked example of a fixing check.

## How It Runs

Two core rules carry the checks: `code-checks` (report-only) and `code-checks-fix` (applies checks that define `fix.replacement`). Both are enabled in the compiled defaults and no-op until an individual check is enabled, and both are profile-scopable like every other rule. Whole-file linting of non-markdown source files through the CLI is a designed seam that is not wired yet; today checks run on fenced blocks in markdown.
