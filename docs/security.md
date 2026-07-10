---
domain: development
category: obsidian-linter-fork
sub-category: documentation
date-created: 2026-07-10
date-revised: 2026-07-10
status: DONE
aliases:
  - security review 2026-07
tags:
  - documentation
  - security
---
# security

## Threat Model

lappe-linter processes three trust tiers of input. Lowest tier: note content, which can arrive from anywhere (synced vaults, pasted text, cloned repos) and is parsed synchronously on every lint by the plugin main thread, the CLI, the pre-commit gate, and the PostToolUse hook. Middle tier: `linter.yaml` and `linter-styles/*.yaml`, semi-trusted because a synced or shared vault and a git pull can both introduce them without the vault owner authoring them. Highest tier: the local toolchain (git, node, the plugin install), assumed trusted. The linter executes no note content and no config content as code; the realistic attack classes are denial of service through pathological input (regex or matcher blow-up freezing a surface), lint-gate bypass (a file the gate silently never lints), and data loss in the settings writeback path. Availability matters more than usual here because the CLI backs a fail-closed pre-commit gate and a hook inside agent tooling.

## Findings and Dispositions

### SEC-001 KEY_LINE frontmatter ReDoS (high) FIXED

`packages/core/src/note-types/frontmatter.ts` matched every frontmatter line against a regex whose bare-key alternative (`[^\s#:-][^:]*?` before `\s*:`) backtracked quadratically on long colon-free whitespace runs; a note like `---\nX<160k spaces>\n---` froze the Obsidian main thread, the CLI, the pre-commit gate, and the PostToolUse hook for seconds to minutes, reachable from the lowest trust tier because yaml-timestamp runs on every file with frontmatter. Fixed by rewriting the alternative to the linear form `[^\s#:-](?:[^:]*[^\s:])?` and adding an `indexOf(':')` bail-out before the regex. Regression tests with a time bound: `packages/core/__tests__/note-types/frontmatter-redos.test.ts`.

### SEC-002 compileGlob exponential backtracking (medium) FIXED

`packages/core/src/scope/matchers.ts` matched `**` by recursing over every skip offset, going exponential when a glob stacked several `**` segments; a `match.path` entry like `**/**/.../**/x` in `linter.yaml` or a style file hung profile resolution on every lint of a moderately deep note. Fixed by collapsing consecutive `**` segments at compile time and replacing the recursion with the greedy two-pointer wildcard algorithm, worst case O(segments x parts). Regression tests with a time bound and semantic parity checks: `packages/core/__tests__/scope/glob-redos.test.ts`.

### SEC-004 --changed drops git-quoted paths (low) FIXED

`packages/cli/src/git-changed.ts` split plain `git diff --name-only` output on newlines, so with the default `core.quotePath=true` a path containing a newline, a quote, or non-ASCII bytes arrived C-quoted, failed the `.md` suffix filter, and silently escaped the pre-commit lint gate. Fixed by switching both diffs to `-z` NUL-terminated output, which disables quoting entirely. Regression test with unicode and quote-carrying filenames: the SEC-004 case in `packages/cli/__tests__/changed.test.ts`.

### SEC-005 linter.yaml writeback lost-update race (low) FIXED

`src/lappe/config-service.ts` wrote settings edits back with an unsynchronized read-modify-write, so an external edit landing between the read and the write (git pull, sync, another editor) was clobbered last-write-wins. Fixed by routing both writers through one helper that re-reads the file immediately before writing and re-applies the mutation to the fresh content when it changed, logging the re-apply. A narrow race window remains by design (Obsidian's adapter offers no compare-and-swap); the residual exposure is one settings edit in a same-millisecond collision, and the file is git-recoverable. Not unit-tested: the service requires the Obsidian `App`/vault runtime, which the jest suites do not mock; the helper centralizes the logic so both writers share the checked path.

### SEC-003 not issued

The review numbered its confirmed findings SEC-001 through SEC-005 with SEC-003 not confirmed; no disposition applies.

## Standing Guarantees

Core purity is test-enforced (`packages/core/__tests__/no-obsidian.test.ts`): rules are pure text transforms with no filesystem or network access, so config and note content cannot reach an execution sink through the rule pipeline. The CLI invokes git via `execFileSync` argument vectors, never a shell, so crafted filenames cannot inject commands. The config loader fails closed on invalid input. The session-side lint hook fails open by design and the pre-commit gate fails closed; both budgets assume the linter terminates, which is why the ReDoS class above was treated as high severity.
