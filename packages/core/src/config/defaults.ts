import {LinterConfig, ProfileConfig} from './types';
import {ConfigError} from './types';
import {parseLinterConfig} from './loader';

/**
 * Compiled defaults (dec-005): what runs with no linter.yaml present, and the
 * baseline a scaffolded config starts from. Timestamps are mandatory; key
 * order, value alphabetization, kebab-case filenames, and h1-matches-stem are
 * on. A vault linter.yaml overrides any of this key by key.
 */
export const DEFAULT_PRIORITY_KEYS = [
  'domain',
  'category',
  'sub-category',
  'date-created',
  'date-revised',
];

export function defaultLinterConfig(): LinterConfig {
  return {
    version: 1,
    defaults: {
      rules: {
        'yaml-key-sort': {enabled: true, 'priority-keys': [...DEFAULT_PRIORITY_KEYS]},
        'yaml-timestamp': {enabled: true},
        'alphabetize-property-values': {enabled: true},
        'h1-matches-stem': {enabled: true},
        'kebab-case-filename': {enabled: true},
        // The code-check rules are on but no-op until an individual check in
        // the code-checks section is enabled (all built-ins default off).
        'code-checks': {enabled: true},
        'code-checks-fix': {enabled: true},
      },
    },
    profiles: {},
    'note-types': {},
    rename: {mode: 'flag'},
    ignore: {folders: [], files: []},
  };
}

export const STYLES_FOLDER = 'linter-styles';

export interface StyleFile {
  /** Profile name, normally the file's stem. */
  name: string;
  /** Raw YAML text of the style file: one profile fragment {match, rules}. */
  text: string;
}

export interface StyleMergeResult {
  config: LinterConfig;
  /** Style files that failed to parse, with why; they are skipped, not fatal. */
  errors: Array<{name: string; errors: ConfigError[]}>;
}

/**
 * Merge style files (dec-005) into a config as named profiles. Each style file
 * is one profile fragment: `match` (its folder/tag/property bindings) plus
 * `rules`. A profile already defined in linter.yaml wins over a style file of
 * the same name; style files merge in name order for determinism.
 */
export function mergeStyleFiles(config: LinterConfig, styles: StyleFile[]): StyleMergeResult {
  const errors: StyleMergeResult['errors'] = [];
  const profiles: Record<string, ProfileConfig> = {};
  for (const style of [...styles].sort((a, b) => a.name.localeCompare(b.name))) {
    // Reuse the strict loader by wrapping the fragment as a single profile.
    const wrapped = `version: 1\nprofiles:\n  ${JSON.stringify(style.name)}:\n${style.text
        .split('\n')
        .map((line) => (line.trim() === '' ? line : `    ${line}`))
        .join('\n')}\n`;
    const parsed = parseLinterConfig(wrapped);
    if (!parsed.ok) {
      errors.push({name: style.name, errors: parsed.errors});
      continue;
    }
    const profile = parsed.config.profiles?.[style.name];
    if (profile) {
      profiles[style.name] = profile;
    }
  }
  return {
    config: {
      ...config,
      profiles: {...profiles, ...(config.profiles ?? {})},
    },
    errors,
  };
}
