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
  /** Age buckets (e.g. ["1-5", "6-10"]) matched against today minus date-created. */
  age?: string[];
  /** date-created range (inclusive), ISO yyyy-MM-dd bounds. */
  'date-created'?: {after?: string; before?: string};
  /** date-revised range (inclusive), ISO yyyy-MM-dd bounds. */
  'date-revised'?: {after?: string; before?: string};
  /** Backlink predicates: note titles/paths that link to this file (host-provided context). */
  backlink?: string[];
  /** Alias predicates matched against this file's aliases (host-provided context). */
  alias?: string[];
}

export interface ProfileConfig {
  match?: ProfileMatch;
  rules?: RulesConfig;
  /** Per-scope rule run order override; same shape as the top-level rule-order. */
  'rule-order'?: string[];
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

/** A frontmatter seed value: scalar, list of scalars, or null (key present, no default). */
export type TemplateFrontmatterValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>
  | null;

/**
 * The global base template every scoped template inherits (F-templates). Owns
 * a frontmatter seed, a body scaffold, and the set of keys the template "pins"
 * (template-owned attributes a scoped child may switch off via `toggles`).
 */
export interface GlobalTemplate {
  /** Keys the template owns; a scoped child may switch them off via `toggles`. */
  'pinned-keys'?: string[];
  /** Frontmatter key order for rendered notes; falls back to the house order. */
  'key-order'?: string[];
  /** Seed frontmatter written into a rendered note. */
  frontmatter?: Record<string, TemplateFrontmatterValue>;
  /** Markdown body scaffold; `{{title}}` is substituted at render time. */
  body?: string;
  /** Emit a trailing `> age: <bucket>` line when a render `today` is supplied. */
  'age-line'?: boolean;
}

/**
 * A property-scoped template: inherits the global base and refines it for a
 * scope (folder, frontmatter property, tag, age, etc.). Everything a scoped
 * template sets overrides the global; `toggles` switch inherited attributes
 * on or off for this scope only.
 */
export interface ScopedTemplate extends GlobalTemplate {
  /** Unique template name. */
  name: string;
  /** Only 'global' is supported today; absent also means inherit the global base. */
  extends?: 'global';
  /** Scope this template applies to; same matcher shape as a profile. */
  match?: ProfileMatch;
  /**
   * Inherited attributes switched on/off for this scope. A key set to off (or
   * false) is dropped from the rendered frontmatter and unpinned; on (or true)
   * is a no-op that documents intent.
   */
  toggles?: Record<string, boolean | 'on' | 'off'>;
}

/** The `templates:` block: one global base plus any property-scoped children. */
export interface TemplatesConfig {
  global?: GlobalTemplate;
  'by-scope'?: ScopedTemplate[];
}

export type AutomationTrigger =
  | 'on-write'
  | 'on-create'
  | 'on-rename'
  | 'pre-commit'
  | 'ci'
  | 'schedule'
  | 'manual';
export type AutomationAction = 'check' | 'fix' | 'apply-template';
/** open = never blocks (authoring); closed = non-zero exit on violations (gates). */
export type AutomationFailure = 'open' | 'closed';
export type AutomationLog = 'spool' | 'none';
export type AutomationReport = 'md' | 'json' | 'none';

/**
 * One rule/automation binding declared under `automations:`: it says WHEN
 * linting runs (trigger), HOW (action), how it fails (failure mode), and where
 * it logs. This is the contract the CLI `run` command, the on-write hook, the
 * pre-commit gate, and scheduled sweeps all read; core only defines the shape.
 */
export interface AutomationConfig {
  name: string;
  trigger: AutomationTrigger;
  /** Defaults to 'check'. */
  action?: AutomationAction;
  /** Defaults to 'open' for authoring triggers, 'closed' for pre-commit/ci gates. */
  failure?: AutomationFailure;
  /** Defaults to 'spool'. */
  log?: AutomationLog;
  /** Defaults to 'none'. When set, a run writes a rollup report in this format. */
  report?: AutomationReport;
  /** Cron expression; required when trigger is 'schedule'. */
  schedule?: string;
  /** Scope restricting which files the automation touches; absent = every file. */
  scope?: ProfileMatch;
}

export interface IgnoreConfig {
  folders?: string[];
  files?: string[];
}

/** The parsed shape of linter.yaml, version 1. */
export interface LinterConfig {
  version: 1;
  defaults?: {rules?: RulesConfig};
  /** Global rule run order: listed ids run first in this order, the rest keep registry order. */
  'rule-order'?: string[];
  profiles?: Record<string, ProfileConfig>;
  'note-types'?: Record<string, NoteTypeSchema>;
  /** Property-based templates: one global base plus scoped children (F-templates). */
  templates?: TemplatesConfig;
  /** Rule/automation bindings: when and how linting runs, per trigger. */
  automations?: AutomationConfig[];
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
  /** ISO yyyy-MM-dd "today", for age-based matchers. */
  today?: string;
  /** Note titles/paths linking to this file (host-provided; empty in the CLI). */
  backlinks?: string[];
  /** This file's aliases (host-provided; empty in the CLI). */
  aliases?: string[];
}

/** The scope engine's output for one file (F02). */
export interface ResolvedProfile {
  /** Profile names that matched, in application order; "defaults" is implicit first. */
  chain: string[];
  /** Final per-rule config after precedence merge. */
  rules: RulesConfig;
  /** Effective rule run order for this file (profile override, else global), when set. */
  ruleOrder?: string[];
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
