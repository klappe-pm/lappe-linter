import {LinterConfig} from './config/types';
import {CoreRuleContext, CoreRuleOptions} from './rule';
import {ResolvedRuleConfig, RuleViolation, runRules} from './runner';
import {splitDocument} from './note-types/frontmatter';
import {getProviderNoteTypes, getProviders, mergeProviderConfig} from './providers';
import {resolveProfile} from './scope';

/**
 * The single lint entry the CLI and the plugin both call (F06 R1). Composes
 * provider config merge, scope resolution, note-type schema threading, and the
 * rule runner into one pure (text, path, config) transform, so plugin/CLI
 * parity holds by construction.
 */

export interface LintTextInput {
  text: string;
  /** Vault-relative path with forward slashes. */
  path: string;
  config: LinterConfig;
  /**
   * Today's date as an ISO yyyy-MM-dd string. Injected as `options.today` for
   * note-type-date-keys; date keys are only written when the caller provides it.
   */
  today?: string;
}

export interface LintTextResult {
  text: string;
  violations: RuleViolation[];
  changed: boolean;
  /** Profile application order, "defaults" implicit first. */
  profileChain: string[];
  /** Note type resolved from note-types matchers, when any. */
  noteType?: string;
}

/** Rule ids that receive `options.schema` from the resolved note type (F03). */
const NOTE_TYPE_RULE_IDS = [
  'note-type-insert-keys',
  'note-type-key-sort',
  'note-type-date-keys',
  'note-type-validate',
] as const;

const DATE_KEYS_RULE_ID = 'note-type-date-keys';

interface MergedEntry {
  providerCount: number;
  merged: LinterConfig;
}

/**
 * Cache the provider-merged config per input config object so the scope
 * engine's own per-config compilation cache stays warm across files.
 * Invalidates when the provider registry grows or shrinks.
 */
const mergedCache = new WeakMap<LinterConfig, MergedEntry>();

function mergedConfigFor(config: LinterConfig): LinterConfig {
  const providerCount = getProviders().length;
  const cached = mergedCache.get(config);
  if (cached && cached.providerCount === providerCount) {
    return cached.merged;
  }
  let merged = mergeProviderConfig(config);
  const providerNoteTypes = getProviderNoteTypes();
  if (Object.keys(providerNoteTypes).length > 0) {
    merged = {
      ...merged,
      'note-types': {...providerNoteTypes, ...(config['note-types'] ?? {})},
    };
  }
  mergedCache.set(config, {providerCount, merged});
  return merged;
}

export function lintText(input: LintTextInput): LintTextResult {
  const merged = mergedConfigFor(input.config);

  const doc = splitDocument(input.text);
  const resolved = resolveProfile(
    {path: input.path, frontmatter: doc.has ? doc.yamlLines.join('\n') : null},
    merged,
  );

  const rules: ResolvedRuleConfig = {};
  for (const [id, stanza] of Object.entries(resolved.rules)) {
    const {enabled, ...options} = stanza;
    rules[id] = enabled === undefined ? {options} : {enabled, options};
  }

  // Mandatory timestamps (dec-005): the global yaml-timestamp rule needs the
  // same churn-guard inputs as note-type-date-keys, on every file.
  {
    const entry = rules['yaml-timestamp'] ?? (rules['yaml-timestamp'] = {});
    const injected: CoreRuleOptions = {originalText: input.text};
    if (input.today !== undefined) {
      injected['today'] = input.today;
    }
    entry.options = {...entry.options, ...injected};
  }

  // Code checks (dec-006): both rules read the config's code-checks section.
  // Enabling any individual check is the enablement intent, so the carrier
  // rules default on when a check is on; an explicit enabled: false in the
  // resolved profile still wins.
  if (merged['code-checks'] !== undefined) {
    const anyCheckEnabled = Object.values(merged['code-checks']).some((check) => check?.enabled === true);
    for (const id of ['code-checks', 'code-checks-fix']) {
      const entry = rules[id] ?? (rules[id] = {});
      entry.options = {...entry.options, checks: merged['code-checks']};
      if (anyCheckEnabled && entry.enabled === undefined) {
        entry.enabled = true;
      }
    }
  }

  const schema = resolved.noteType !== undefined ? merged['note-types']?.[resolved.noteType] : undefined;
  if (schema) {
    for (const id of NOTE_TYPE_RULE_IDS) {
      const injected: CoreRuleOptions = {schema};
      if (id === DATE_KEYS_RULE_ID) {
        injected['originalText'] = input.text;
        if (input.today !== undefined) {
          injected['today'] = input.today;
        }
      }
      const entry = rules[id] ?? (rules[id] = {});
      entry.options = {...entry.options, ...injected};
    }
  }

  const ctx: CoreRuleContext = {
    path: input.path,
    profile: resolved.chain[resolved.chain.length - 1],
  };
  if (resolved.noteType !== undefined) {
    ctx.noteType = resolved.noteType;
  }

  const run = runRules(input.text, {rules, ctx});
  const result: LintTextResult = {
    text: run.text,
    violations: run.violations,
    changed: run.changed,
    profileChain: resolved.chain,
  };
  if (resolved.noteType !== undefined) {
    result.noteType = resolved.noteType;
  }
  return result;
}
