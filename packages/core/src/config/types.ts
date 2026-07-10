import {CoreRuleOptions} from '../rule';

/**
 * Shared contract types for the linter.yaml control plane (F01), the scope
 * engine (F02), note-type schemas (F03), and the provider API (F08). Every
 * feature implements against these types; do not fork private variants.
 */

/** Per-rule stanza inside `defaults.rules` or a profile's `rules`. */
export interface RuleConfig {
  enabled?: boolean;
  [option: string]: unknown;
}

export type RulesConfig = Record<string, RuleConfig>;

/** Matchers deciding whether a profile applies to a file. */
export interface ProfileMatch {
  /** Path globs, picomatch syntax, vault-relative. */
  path?: string[];
  /** File extensions without the dot, e.g. ["md"]. */
  extension?: string[];
  /** Frontmatter key-value predicates: exact match or list-contains. */
  frontmatter?: Record<string, string | number | boolean | Array<string | number | boolean>>;
  /** Tag predicates matched against frontmatter tags. */
  tag?: string[];
}

export interface ProfileConfig {
  match?: ProfileMatch;
  rules?: RulesConfig;
}

/** One note type's frontmatter schema (F03). */
export interface NoteTypeSchema {
  /** Required keys; value is the default inserted when the key is absent (null = no default). */
  required?: Record<string, string | number | boolean | Array<string | number | boolean> | null>;
  /** Key order; unlisted keys sort alphabetically after these, aliases and tags last. */
  'key-order'?: string[];
  /** Allowed value sets per key. */
  values?: Record<string, Array<string | number | boolean>>;
  /** Keys managed as dates: date-created set on first lint, date-revised on change. */
  'date-keys'?: {created?: string; revised?: string};
  /** Matcher binding a file to this note type; same semantics as ProfileMatch.frontmatter. */
  match?: ProfileMatch;
}

export interface RenameConfig {
  /** off = rule disabled, flag = report only, rename = fix with link updates. */
  mode: 'off' | 'flag' | 'rename';
}

export interface IgnoreConfig {
  folders?: string[];
  files?: string[];
}

/** The parsed shape of linter.yaml, version 1. */
export interface LinterConfig {
  version: 1;
  defaults?: {rules?: RulesConfig};
  profiles?: Record<string, ProfileConfig>;
  'note-types'?: Record<string, NoteTypeSchema>;
  rename?: RenameConfig;
  ignore?: IgnoreConfig;
  /** Provider config namespaces (F08): providers.<namespace> mirrors defaults/profiles. */
  providers?: Record<string, {rules?: RulesConfig}>;
  /**
   * Declarative code checks (dec-006): pattern rules over fenced code blocks,
   * harness-hook-inspired but never executed code, only bounded regex. Keyed
   * by check id; built-ins merge underneath so user config wins.
   */
  'code-checks'?: Record<string, CodeCheckConfig>;
}

/** One declarative code check. Patterns are user-authored but execution is bounded. */
export interface CodeCheckConfig {
  enabled?: boolean;
  description?: string;
  /** Vault-relative path globs restricting where the check runs; absent = everywhere. */
  paths?: string[];
  /** Fence languages this check applies to (e.g. ["bash", "sh"]); absent = every fence. */
  languages?: string[];
  /** Regex source, compiled per line with length and match caps; invalid = check skipped. */
  pattern?: string;
  /** Regex flags; "g" is implied for fixing checks. */
  flags?: string;
  /** Violation message; must never echo matched text (secrets stay out of every output). */
  message?: string;
  /** Present = the check can fix by replacement when its fixing rule is enabled. */
  fix?: {replacement: string};
}

/** Inputs the resolver needs for one file. Pure data, no vault access. */
export interface FileFacts {
  /** Vault-relative path with forward slashes. */
  path: string;
  /** Raw frontmatter YAML text (without --- fences), or null when absent. */
  frontmatter: string | null;
}

/** The scope engine's output for one file (F02). */
export interface ResolvedProfile {
  /** Profile names that matched, in application order; "defaults" is implicit first. */
  chain: string[];
  /** Final per-rule config after precedence merge. */
  rules: RulesConfig;
  /** Note type resolved from note-types matchers, when any. */
  noteType?: string;
}

export interface ConfigError {
  path: string;
  message: string;
}

/** Loader outcome (F01): fail closed, never a partial apply. */
export type LoadResult =
  | {ok: true; config: LinterConfig; warnings: string[]}
  | {ok: false; errors: ConfigError[]};
