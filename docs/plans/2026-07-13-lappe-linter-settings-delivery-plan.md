# Lappe Linter settings, scoping, preview, and runtime delivery plan

- Plan ID: `lappe-linter-settings-delivery`
- Status: `draft`

## Objective

Deliver the requested Lappe Linter behavior in a fresh Obsidian vault: deterministic loading and wand linting, the exact settings architecture, YAML/header/body/special-formatting controls, real side-by-side preview, reusable scopes, metadata matching, inheritance, and evidence-based release verification.

## Non-goals

- Merge lappe-linter into product-management-plugin.
- Replace the tested @lappe-linter/core engine with the Product Management preview engine.
- Delete upstream rules or historical plans; hide legacy settings only where the user requested a simplified surface.
- Treat a synthetic preformatted preview or unit tests alone as the requested Obsidian side-by-side validation.
- Expand the Product Management pipeline or session-data producer as part of Lappe delivery.

## Assumptions

- The repository default branch is master and the Lappe plugin id is lappe-linter.
- The current pure core and existing rule tests are the implementation base, not throwaway work.
- linter.yaml is the canonical user-editable Lappe configuration and must remain comment-preserving.
- The exact filename-flow trigger remains a decision until verified against Obsidian rename and paste behavior.
- A throwaway vault at /private/tmp/lappe-linter-obssmoke may be created for manual validation.
- Product Management remains a separate plugin with its own plan and release artifact.

## Decisions needed

- DEC-001: Resolve the source wording conflict between date-revised in the default key order and date-updated in the kept timestamp options. Recommendation: use date-revised everywhere because the current core, scaffold, and existing plan use date-revised.
- DEC-002: Confirm the preview contract is a real Markdown note or workspace leaf on the left and the settings panel on the right, not a modal or static preformatted block. This plan assumes the non-blocking workspace-leaf design.
- DEC-003: Define the exact automatic application trigger for filename/header behavior: rename transition, paste, save, or an explicit lint action. The trigger must be tested rather than implied by a comment.
- DEC-004: Scope combination semantics: recommended AND across selected scope types and OR among values within one type.
- DEC-005: Decide whether linter-styles are intentionally Obsidian-only or must reach CLI parity. This does not block the exact settings-tab work but must be documented before release.
- DEC-006: Define the final profile override editor shape so each inherited option can be explicitly reset to inherited or set as an override.

## Risks

- The current dirty primary checkout contains user-owned documentation and source changes; all implementation lanes must start from a clean linked worktree and never reset the primary.
- The bundle currently allows TypeScript/API mismatches that a type-aware gate must catch.
- A settings refactor can accidentally leave duplicate rule controls in old tabs, creating conflicting persistence paths.
- Scope matching can appear to work in pure tests while failing in Obsidian if metadata-cache backlinks, aliases, or frontmatter are not threaded correctly.
- A modal or static preview can be incorrectly reported as live side-by-side behavior.
- Filename, date, and timestamp naming inconsistencies can create silent metadata drift.

## PR sequence

| PR | Title | Depends on | Owner | Exit |
|---|---|---|---|---|
| `PR-001` | fix(plugin): make fresh-vault loading and wand linting deterministic | none | runtime/bootstrap lane | `ready_for_review` |
| `PR-002` | feat(settings): replace legacy tabs with the requested settings surface | PR-001 | settings surface lane | `ready_for_review` |
| `PR-003` | feat(core): complete formatting scopes and inheritance semantics | PR-002 | core semantics lane | `ready_for_review` |
| `PR-004` | feat(obsidian): add real side-by-side preview and release acceptance gate | PR-003 | Obsidian integration and release lane | `ready_for_review` |

## PR-001: fix(plugin): make fresh-vault loading and wand linting deterministic

Fix the entry-point failure so a fresh vault loads the fork and the wand performs a visible, testable lint operation in every supported active-file state.

- Repository: `/Users/kevinlappe/Projects/lappe-linter`
- Branch: `agent/pr-001-fresh-vault-wand`
- Worktree: `/Users/kevinlappe/Projects/_worktrees/lappe-linter/pr-01-debug-wand`
- Paths owned: `manifest.json`, `scripts/install-test-vault.sh`, `src/main.ts`, `src/lappe/ribbon-action.ts`, `__tests__/lappe-ribbon-action.test.ts`, `packages/core/__tests__/integration/lint-file.test.ts`
- Merge policy: `review_required`

### Tasks

- Verify manifest id, install destination, enabled plugin id, and fresh-vault artifact set.
- Trace the ribbon callback from click through command check, active TFile resolution, core lint, vault modify, and notice/report.
- Ensure reading view and no-editor states use the whole-file path when a Markdown file is active.
- Ensure no-file state produces a deterministic localized notice.
- Add regression tests for each state and a fresh-vault install assertion.

### Verification

#### preflight

- git status --short --branch
- Confirm worktree is based on origin/master and primary checkout is untouched.

#### local

- TEST-001
- TEST-002
- npm run build

#### ci

- Repository build/test workflow.

#### integration

- TEST-009 after PR-002, PR-003, and PR-004.

#### negative

- No silent no-op when reading view is active.
- No write when no Markdown file exists.
- Malformed config fails closed with a visible notice.

### Acceptance

- A new vault loads lappe-linter from the documented install flow.
- Wand changes a real Markdown file in editing and reading view.
- No-file behavior is visible and actionable.
- The active-file path uses the same Lappe core as CLI/config tests.

## PR-002: feat(settings): replace legacy tabs with the requested settings surface

Refactor the actual Obsidian settings navigation and wire the requested YAML, Headers, Body, Special formatting, Scopes, and Rule order surfaces without a bolted-on Lappe or Style tab.

- Repository: `/Users/kevinlappe/Projects/lappe-linter`
- Branch: `agent/pr-002-canonical-settings-surface`
- Worktree: `/Users/kevinlappe/Projects/_worktrees/lappe-linter/pr-02-settings-surface`
- Paths owned: `src/ui/settings.ts`, `src/ui/linter-components/tab-components/lappe-tab.ts`, `src/lappe/yaml-suggest.ts`, `src/lappe/reorder.ts`, `__tests__/setting-controls.test.ts`, `__tests__/lappe-yaml-controls.test.ts`, `__tests__/lappe-settings-tabs.test.ts`
- Merge policy: `review_required`

### Tasks

- Fix the LappeTab constructor/registration contract before moving behavior.
- Register exactly General, YAML, Headers, Body, Special formatting, Scopes, Rule order, Custom, and Debug; remove Lappe and Style registrations.
- Implement YAML order preset, domain, category, sub-category, types, date-created, date-revised, links, aliases, tags, blank row with drag/drop and no separate key-sort option.
- Use vault key/value suggestions with alphabetical initial values and narrowing as the user types; keep consistent blank-row add/remove controls.
- Keep only the requested YAML controls, default retained toggles ON, and explicitly record DEC-001 before choosing date-updated versus date-revised.
- Wire Headers, Body, Special formatting, and Rule order sections to the canonical config service without duplicate legacy controls.
- Remove the dead legacy section method and undefined sections reference; add source contract tests.

### Verification

#### preflight

- Review current lappe-tab.ts diff and the original prompt.
- Confirm no unrelated source or docs are staged.

#### local

- TEST-004
- TEST-005
- TEST-006
- TEST-007
- TEST-008
- npm run build

#### ci

- Full Jest suite, production build, ESLint, and package checks.

#### integration

- TEST-009 after PR-003 and PR-004.

#### negative

- No Lappe or Style tab.
- No free-text-only YAML suggestion implementation.
- No duplicate YAML/header/body rule controls in hidden legacy tabs.
- No constructor/API mismatch in changed settings paths.

### Acceptance

- The exact tab names appear in the real Obsidian settings UI.
- YAML controls write comment-preserving linter.yaml changes.
- Headers, Body, Special formatting, and Rule order are reachable from their requested tabs.
- The plan's date naming decision is explicit and tested.
- The settings refactor does not destroy existing core rule support.

## PR-003: feat(core): complete formatting scopes and inheritance semantics

Make the rule, scope, metadata, age, ordering, inheritance, and CLI semantics complete and deterministic behind the settings surface.

- Repository: `/Users/kevinlappe/Projects/lappe-linter`
- Branch: `agent/pr-003-core-scopes-inheritance`
- Worktree: `/Users/kevinlappe/Projects/_worktrees/lappe-linter/pr-03-core-semantics`
- Paths owned: `packages/core/src/rules-content/header-case.ts`, `packages/core/src/rules-content/paragraph-spacing.ts`, `packages/core/src/rules-content/list-style.ts`, `packages/core/src/scope`, `packages/core/src/config`, `packages/core/src/runner.ts`, `src/lappe/config-service.ts`, `src/lappe/scope-builder-model.ts`, `packages/cli/src`, `packages/core/__tests__/rules-content`, `packages/core/__tests__/scope`, `packages/core/__tests__/config`, `packages/core/__tests__/rule-order.test.ts`, `packages/cli/__tests__`, `__tests__/lappe-rename-trigger.test.ts`
- Merge policy: `review_required`

### Tasks

- Implement or verify header-case options and filename-to-H1 behavior with explicit Untitled handling.
- Implement or verify paragraph spacing 0/1/2, bullet marker/tightness, and artificial-line-break removal while preserving code/frontmatter/quote/table zones.
- Implement or verify code, quote, table, callout, and other special-formatting semantics with fixtures and idempotency tests.
- Implement all scope matchers and fixed-date tests for folder, file, path, properties, tags, backlinks, aliases, domain, category, sub-category, date-created, date-revised, age, project, and types.
- Use AND across selected scope types and OR within values unless DEC-004 changes the contract.
- Thread Obsidian metadata-cache backlinks and aliases into the plugin resolver and document CLI limitations.
- Implement inherited versus overridden option state, reset-to-inherited behavior, base-change propagation, and explicit push-template action.
- Verify global and per-profile locked-first/manual/alphabetical rule ordering.

### Verification

#### preflight

- Confirm PR-002 has merged or use its exact commit as the base.
- Run targeted core tests before changing semantics.

#### local

- TEST-003
- TEST-006
- TEST-007
- TEST-008
- TEST-010
- npm test -- --runInBand packages/core/__tests__ packages/cli/__tests__

#### ci

- Full Jest suite, core build, CLI build, production build, ESLint.

#### integration

- TEST-009 after PR-004.

#### negative

- Malformed scope values do not match everything.
- Missing metadata-cache context does not fabricate backlink/alias matches.
- Inherited values do not become overrides during a base edit.
- Null/empty YAML metadata does not produce accidental scope matches.

### Acceptance

- Every requested scope type has a tested resolver path or an explicit documented limitation.
- Age buckets match the exact five-day contract and today rounds to 1.
- Base/profile inheritance is observable and resettable.
- CLI and Obsidian behavior have an explicit parity statement.
- Core tests remain green and transformations are idempotent.

## PR-004: feat(obsidian): add real side-by-side preview and release acceptance gate

Replace the modal/static preview assumption with a real Obsidian workspace interaction and make the final release claim depend on an exact artifact acceptance record.

- Repository: `/Users/kevinlappe/Projects/lappe-linter`
- Branch: `agent/pr-004-obsidian-preview-release`
- Worktree: `/Users/kevinlappe/Projects/_worktrees/lappe-linter/pr-04-obsidian-release`
- Paths owned: `src/ui/modals/lappe-preview-modal.ts`, `src/ui/lappe-preview-view.ts`, `src/lappe/preview-sample.ts`, `scripts/verify-test-vault.sh`, `__tests__/lappe-preview-sample.test.ts`, `docs/verification/lappe-obsidian-acceptance.md`
- Merge policy: `review_required`

### Tasks

- Create a real Markdown sample note containing every requested syntax category.
- Open the sample note in a workspace leaf on the left and the settings panel on the right; do not use a blocking modal as the acceptance surface.
- Re-render or re-lint the real sample when relevant settings/config changes, preserving the note as a visible before/after test target.
- Add scripts/verify-test-vault.sh to install, identify, hash, and report the exact plugin artifact.
- Write the acceptance record with tab names, wand states, YAML/header/body/special outputs, scope match/non-match, inheritance, reload, and artifact hash.
- Run the full suite/build and stop release if any P0/P1 or acceptance item remains unverified.

### Verification

#### preflight

- Confirm PR-003 is merged and the source artifact is clean in the task worktree.
- Confirm throwaway vault path is not a production vault.

#### local

- TEST-009
- TEST-011
- git diff --check

#### ci

- Full repository CI and release/package checks.

#### integration

- Fresh-vault Obsidian acceptance record attached to the PR.

#### negative

- Preview is not a static pre block only.
- Preview is not a blocking modal only.
- Artifact hash in the acceptance record matches the installed main.js.
- Reload is performed after installation and after linter.yaml changes.

### Acceptance

- A user can see a real note and settings side by side.
- All requested behavior is visible in the note and reproducible after reload.
- The acceptance record identifies the exact artifact and vault.
- Release is blocked when manual verification is missing.

## Automation

### preflight

- Read the newest Lappe passoff and this plan before selecting a PR lane.
- Confirm the primary checkout is browse-only and the task worktree is based on current origin/master.
- Run git status --short --branch and record unrelated dirty paths before editing.

### scheduling

- PR-001 is the root runtime lane.
- PR-002 depends on PR-001 and owns the shared settings UI files.
- PR-003 depends on PR-002 and owns core/config/CLI semantics, avoiding shared settings files.
- PR-004 depends on PR-003 and owns preview/release integration and evidence.
- Only the integration owner resolves conflicts or merges lanes.

### closeout

- Run the lane's local checks and full required suite.
- Push the named branch, open the named PR with the specified message/body, and wait for required CI.
- Merge only when required checks pass, no unresolved review threads remain, and the acceptance evidence is attached.
- Fast-forward local master after merge and record the merge SHA in the passoff.
