/**
 * The pure rule contract for lappe-linter core. Every rule is a deterministic
 * (text, options, ctx) => string transform with no Obsidian and no filesystem
 * access. The Obsidian plugin and the headless CLI both run these identically.
 */

export type CoreRuleOptions = Record<string, unknown>;

/**
 * Context passed to a rule by the runner. The scope engine (F02) fills
 * `profile` and `noteType`; the runner fills `path`. Rules must stay pure:
 * read from ctx, never mutate it, never touch the disk.
 */
export interface CoreRuleContext {
  /** Vault-relative path of the file being linted, when known. */
  path?: string;
  /** Resolved profile name that produced these options, when known. */
  profile?: string;
  /** Resolved note type of the file, when known. */
  noteType?: string;
}

export type CoreRuleApply = (
  text: string,
  options: CoreRuleOptions,
  ctx?: CoreRuleContext,
) => string;

export type CoreRuleCategory =
  | 'content'
  | 'frontmatter'
  | 'filename'
  | 'note-type'
  | 'provider';

export interface CoreRuleExample {
  description: string;
  before: string;
  after: string;
  options?: CoreRuleOptions;
}

export interface CoreRule {
  /** Stable kebab-case identifier, unique across the registry. */
  id: string;
  category: CoreRuleCategory;
  /** One-line human description, surfaced by `lappe-linter explain`. */
  description: string;
  apply: CoreRuleApply;
  /** Options applied when the profile does not override them. */
  defaultOptions?: CoreRuleOptions;
  /** Report-only rules never mutate text; they only surface violations. */
  reportOnly?: boolean;
  /** Worked examples; double as the rule's test corpus. */
  examples?: CoreRuleExample[];
}

const registry = new Map<string, CoreRule>();

/** Register a rule. Throws on duplicate id so collisions fail loudly. */
export function registerRule(rule: CoreRule): CoreRule {
  if (registry.has(rule.id)) {
    throw new Error(`lappe-linter: duplicate rule id "${rule.id}"`);
  }
  registry.set(rule.id, rule);
  return rule;
}

export function getRule(id: string): CoreRule | undefined {
  return registry.get(id);
}

export function getRules(): CoreRule[] {
  return [...registry.values()];
}

/** Test-only: clear the registry. Not part of the public runtime contract. */
export function _resetRegistryForTests(): void {
  registry.clear();
}
