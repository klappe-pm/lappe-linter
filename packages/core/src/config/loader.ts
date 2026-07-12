import {parse} from 'yaml';
import {ConfigError, LinterConfig, LoadResult} from './types';

/** Canonical control-plane filename at the vault root (dec-002). */
export const CANONICAL_CONFIG_FILENAME = 'linter.yaml';

/**
 * Accepted config filenames, canonical first. When both exist on disk the
 * canonical name wins (dec-002). Discovery itself is CLI/plugin-side; core
 * only exposes the contract.
 */
export const CONFIG_FILENAME_ALIASES: readonly string[] = [
  CANONICAL_CONFIG_FILENAME,
  'lappe-linter.yaml',
];

const TOP_LEVEL_KEYS = new Set([
  'version',
  'defaults',
  'rule-order',
  'profiles',
  'note-types',
  'rename',
  'ignore',
  'providers',
  'code-checks',
]);

const MATCH_KEYS = new Set(['path', 'extension', 'frontmatter', 'tag', 'age', 'date-created', 'date-revised', 'backlink', 'alias']);
const PROFILE_KEYS = new Set(['match', 'rules', 'rule-order']);
const NOTE_TYPE_KEYS = new Set(['required', 'key-order', 'values', 'date-keys', 'match']);
const RENAME_MODES = new Set(['off', 'flag', 'rename']);
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = ISO_DATE.exec(value);
  if (match == null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return month >= 1 && month <= 12 && day >= 1 &&
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isScalarArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isScalar);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

class Validation {
  errors: ConfigError[] = [];
  warnings: string[] = [];

  error(path: string, message: string): void {
    this.errors.push({path, message});
  }

  warn(message: string): void {
    this.warnings.push(message);
  }
}

function validateRules(v: Validation, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    v.error(path, 'must be a mapping of rule id to rule config');
    return;
  }
  for (const [ruleId, ruleCfg] of Object.entries(value)) {
    const rulePath = `${path}.${ruleId}`;
    if (!isPlainObject(ruleCfg)) {
      v.error(rulePath, 'rule config must be a mapping');
      continue;
    }
    if ('enabled' in ruleCfg && typeof ruleCfg.enabled !== 'boolean') {
      v.error(`${rulePath}.enabled`, 'must be a boolean');
    }
  }
}

function validateMatch(v: Validation, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    v.error(path, 'must be a mapping');
    return;
  }
  for (const key of Object.keys(value)) {
    if (!MATCH_KEYS.has(key)) {
      v.warn(`unknown key "${path}.${key}" ignored`);
    }
  }
  for (const listKey of ['path', 'extension', 'tag', 'age', 'backlink', 'alias'] as const) {
    if (listKey in value && !isStringArray(value[listKey])) {
      v.error(`${path}.${listKey}`, 'must be a list of strings');
    }
  }
  for (const rangeKey of ['date-created', 'date-revised'] as const) {
    if (rangeKey in value) {
      const range = value[rangeKey];
      if (!isPlainObject(range)) {
        v.error(`${path}.${rangeKey}`, 'must be a mapping with after and/or before');
      } else {
        for (const bound of ['after', 'before']) {
          if (bound in range && !isValidIsoDate(range[bound])) {
            v.error(`${path}.${rangeKey}.${bound}`, 'must be an ISO yyyy-MM-dd string');
          }
        }
      }
    }
  }
  if ('frontmatter' in value) {
    const fm = value.frontmatter;
    if (!isPlainObject(fm)) {
      v.error(`${path}.frontmatter`, 'must be a mapping of key to value predicate');
    } else {
      for (const [fmKey, fmValue] of Object.entries(fm)) {
        if (!isScalar(fmValue) && !isScalarArray(fmValue)) {
          v.error(`${path}.frontmatter.${fmKey}`, 'must be a scalar or a list of scalars');
        }
      }
    }
  }
}

function validateProfiles(v: Validation, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    v.error(path, 'must be a mapping of profile name to profile config');
    return;
  }
  for (const [name, profile] of Object.entries(value)) {
    const profilePath = `${path}.${name}`;
    if (!isPlainObject(profile)) {
      v.error(profilePath, 'profile must be a mapping');
      continue;
    }
    for (const key of Object.keys(profile)) {
      if (!PROFILE_KEYS.has(key)) {
        v.warn(`unknown key "${profilePath}.${key}" ignored`);
      }
    }
    if ('match' in profile) {
      validateMatch(v, profile.match, `${profilePath}.match`);
    }
    if ('rules' in profile) {
      validateRules(v, profile.rules, `${profilePath}.rules`);
    }
    if ('rule-order' in profile && !isStringArray(profile['rule-order'])) {
      v.error(`${profilePath}.rule-order`, 'must be a list of rule ids');
    }
  }
}

function validateNoteTypes(v: Validation, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    v.error(path, 'must be a mapping of note type name to schema');
    return;
  }
  for (const [name, schema] of Object.entries(value)) {
    const schemaPath = `${path}.${name}`;
    if (!isPlainObject(schema)) {
      v.error(schemaPath, 'note type schema must be a mapping');
      continue;
    }
    for (const key of Object.keys(schema)) {
      if (!NOTE_TYPE_KEYS.has(key)) {
        v.warn(`unknown key "${schemaPath}.${key}" ignored`);
      }
    }
    if ('required' in schema) {
      const required = schema.required;
      if (!isPlainObject(required)) {
        v.error(`${schemaPath}.required`, 'must be a mapping of key to default value');
      } else {
        for (const [reqKey, reqValue] of Object.entries(required)) {
          if (reqValue !== null && !isScalar(reqValue) && !isScalarArray(reqValue)) {
            v.error(`${schemaPath}.required.${reqKey}`, 'must be a scalar, a list of scalars, or null');
          }
        }
      }
    }
    if ('key-order' in schema && !isStringArray(schema['key-order'])) {
      v.error(`${schemaPath}.key-order`, 'must be a list of strings');
    }
    if ('values' in schema) {
      const values = schema.values;
      if (!isPlainObject(values)) {
        v.error(`${schemaPath}.values`, 'must be a mapping of key to allowed values');
      } else {
        for (const [valKey, allowed] of Object.entries(values)) {
          if (!isScalarArray(allowed)) {
            v.error(`${schemaPath}.values.${valKey}`, 'must be a list of scalars');
          }
        }
      }
    }
    if ('date-keys' in schema) {
      const dateKeys = schema['date-keys'];
      if (!isPlainObject(dateKeys)) {
        v.error(`${schemaPath}.date-keys`, 'must be a mapping with optional created/revised keys');
      } else {
        for (const key of Object.keys(dateKeys)) {
          if (key !== 'created' && key !== 'revised') {
            v.warn(`unknown key "${schemaPath}.date-keys.${key}" ignored`);
          } else if (typeof dateKeys[key] !== 'string') {
            v.error(`${schemaPath}.date-keys.${key}`, 'must be a string');
          }
        }
      }
    }
    if ('match' in schema) {
      validateMatch(v, schema.match, `${schemaPath}.match`);
    }
  }
}

function validateRename(v: Validation, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    v.error(path, 'must be a mapping with a mode key');
    return;
  }
  for (const key of Object.keys(value)) {
    if (key !== 'mode') {
      v.warn(`unknown key "${path}.${key}" ignored`);
    }
  }
  if (typeof value.mode !== 'string' || !RENAME_MODES.has(value.mode)) {
    v.error(`${path}.mode`, 'must be one of "off", "flag", "rename"');
  }
}

function validateIgnore(v: Validation, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    v.error(path, 'must be a mapping with optional folders/files lists');
    return;
  }
  for (const key of Object.keys(value)) {
    if (key !== 'folders' && key !== 'files') {
      v.warn(`unknown key "${path}.${key}" ignored`);
    }
  }
  for (const listKey of ['folders', 'files'] as const) {
    if (listKey in value && !isStringArray(value[listKey])) {
      v.error(`${path}.${listKey}`, 'must be a list of strings');
    }
  }
}

function validateProviders(v: Validation, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    v.error(path, 'must be a mapping of provider namespace to config');
    return;
  }
  for (const [namespace, providerCfg] of Object.entries(value)) {
    const providerPath = `${path}.${namespace}`;
    if (!isPlainObject(providerCfg)) {
      v.error(providerPath, 'provider config must be a mapping');
      continue;
    }
    for (const key of Object.keys(providerCfg)) {
      if (key !== 'rules') {
        v.warn(`unknown key "${providerPath}.${key}" ignored`);
      }
    }
    if ('rules' in providerCfg) {
      validateRules(v, providerCfg.rules, `${providerPath}.rules`);
    }
  }
}

const CODE_CHECK_KEYS = new Set(['enabled', 'description', 'paths', 'languages', 'pattern', 'flags', 'message', 'fix']);

/**
 * Code checks are additive: a malformed individual check must not fail-close
 * the whole config, so per-check problems are warnings and the check is
 * skipped at build time. Only a non-mapping section is a hard error.
 */
function validateCodeChecks(v: Validation, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    v.error(path, 'must be a mapping of check id to check definition');
    return;
  }
  for (const [id, check] of Object.entries(value)) {
    const checkPath = `${path}.${id}`;
    if (!isPlainObject(check)) {
      v.warn(`"${checkPath}" skipped: must be a mapping`);
      continue;
    }
    for (const key of Object.keys(check)) {
      if (!CODE_CHECK_KEYS.has(key)) {
        v.warn(`unknown key "${checkPath}.${key}" ignored`);
      }
    }
    if ('pattern' in check && typeof check.pattern !== 'string') {
      v.warn(`"${checkPath}" skipped: pattern must be a string`);
    }
    if ('languages' in check && !isStringArray(check.languages)) {
      v.warn(`"${checkPath}" skipped: languages must be a list of strings`);
    }
    if ('paths' in check && !isStringArray(check.paths)) {
      v.warn(`"${checkPath}" skipped: paths must be a list of strings`);
    }
  }
}

/**
 * Parse and validate a linter.yaml text against the LinterConfig contract.
 * Fail closed: any structural error yields {ok: false} with every error found,
 * never a partial config. Unknown top-level keys are warnings, not errors.
 */
export function parseLinterConfig(yamlText: string): LoadResult {
  let raw: unknown;
  try {
    raw = parse(yamlText);
  } catch (err) {
    return {ok: false, errors: [{path: '', message: `yaml parse error: ${(err as Error).message}`}]};
  }

  const v = new Validation();

  if (!isPlainObject(raw)) {
    v.error('', 'config must be a yaml mapping');
    return {ok: false, errors: v.errors};
  }

  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      v.warn(`unknown key "${key}" ignored`);
    }
  }

  if (raw.version !== 1) {
    v.error('version', 'must be 1');
  }

  if ('defaults' in raw) {
    const defaults = raw.defaults;
    if (!isPlainObject(defaults)) {
      v.error('defaults', 'must be a mapping');
    } else {
      for (const key of Object.keys(defaults)) {
        if (key !== 'rules') {
          v.warn(`unknown key "defaults.${key}" ignored`);
        }
      }
      if ('rules' in defaults) {
        validateRules(v, defaults.rules, 'defaults.rules');
      }
    }
  }

  if ('rule-order' in raw && !isStringArray(raw['rule-order'])) {
    v.error('rule-order', 'must be a list of rule ids');
  }

  if ('profiles' in raw) {
    validateProfiles(v, raw.profiles, 'profiles');
  }
  if ('note-types' in raw) {
    validateNoteTypes(v, raw['note-types'], 'note-types');
  }
  if ('rename' in raw) {
    validateRename(v, raw.rename, 'rename');
  }
  if ('ignore' in raw) {
    validateIgnore(v, raw.ignore, 'ignore');
  }
  if ('providers' in raw) {
    validateProviders(v, raw.providers, 'providers');
  }
  if ('code-checks' in raw) {
    validateCodeChecks(v, raw['code-checks'], 'code-checks');
  }

  if (v.errors.length > 0) {
    return {ok: false, errors: v.errors};
  }
  return {ok: true, config: raw as unknown as LinterConfig, warnings: v.warnings};
}
