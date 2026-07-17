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
  'templates',
  'automations',
  'rename',
  'ignore',
  'providers',
  'code-checks',
]);

const MATCH_KEYS = new Set(['path', 'extension', 'frontmatter', 'tag', 'age', 'date-created', 'date-revised', 'backlink', 'alias']);
const PROFILE_KEYS = new Set(['match', 'rules', 'rule-order']);
const NOTE_TYPE_KEYS = new Set(['required', 'key-order', 'values', 'date-keys', 'match']);
const GLOBAL_TEMPLATE_KEYS = new Set(['pinned-keys', 'key-order', 'frontmatter', 'body', 'age-line']);
const SCOPED_TEMPLATE_KEYS = new Set(['name', 'extends', 'match', 'toggles', 'pinned-keys', 'key-order', 'frontmatter', 'body', 'age-line']);
const TEMPLATES_KEYS = new Set(['global', 'by-scope']);
const AUTOMATION_KEYS = new Set(['name', 'trigger', 'action', 'failure', 'log', 'report', 'schedule', 'scope']);
const AUTOMATION_TRIGGERS = new Set(['on-write', 'on-create', 'on-rename', 'pre-commit', 'ci', 'schedule', 'manual']);
const AUTOMATION_ACTIONS = new Set(['check', 'fix', 'apply-template']);
const AUTOMATION_FAILURES = new Set(['open', 'closed']);
const AUTOMATION_LOGS = new Set(['spool', 'none']);
const AUTOMATION_REPORTS = new Set(['md', 'json', 'none']);
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

function validateTemplateFrontmatter(v: Validation, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    v.error(path, 'must be a mapping of key to seed value');
    return;
  }
  for (const [key, seed] of Object.entries(value)) {
    if (seed !== null && !isScalar(seed) && !isScalarArray(seed)) {
      v.error(`${path}.${key}`, 'must be a scalar, a list of scalars, or null');
    }
  }
}

function validateTemplateFields(v: Validation, obj: Record<string, unknown>, path: string, allowed: Set<string>): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      v.warn(`unknown key "${path}.${key}" ignored`);
    }
  }
  for (const listKey of ['pinned-keys', 'key-order'] as const) {
    if (listKey in obj && !isStringArray(obj[listKey])) {
      v.error(`${path}.${listKey}`, 'must be a list of strings');
    }
  }
  if ('frontmatter' in obj) {
    validateTemplateFrontmatter(v, obj.frontmatter, `${path}.frontmatter`);
  }
  if ('body' in obj && typeof obj.body !== 'string') {
    v.error(`${path}.body`, 'must be a string');
  }
  if ('age-line' in obj && typeof obj['age-line'] !== 'boolean') {
    v.error(`${path}.age-line`, 'must be a boolean');
  }
}

function validateTemplates(v: Validation, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    v.error(path, 'must be a mapping with optional global and by-scope');
    return;
  }
  for (const key of Object.keys(value)) {
    if (!TEMPLATES_KEYS.has(key)) {
      v.warn(`unknown key "${path}.${key}" ignored`);
    }
  }
  if ('global' in value) {
    if (!isPlainObject(value.global)) {
      v.error(`${path}.global`, 'must be a mapping');
    } else {
      validateTemplateFields(v, value.global, `${path}.global`, GLOBAL_TEMPLATE_KEYS);
    }
  }
  if ('by-scope' in value) {
    const scoped = value['by-scope'];
    if (!Array.isArray(scoped)) {
      v.error(`${path}.by-scope`, 'must be a list of scoped templates');
      return;
    }
    const seen = new Set<string>();
    scoped.forEach((entry, index) => {
      const entryPath = `${path}.by-scope[${index}]`;
      if (!isPlainObject(entry)) {
        v.error(entryPath, 'scoped template must be a mapping');
        return;
      }
      if (typeof entry.name !== 'string' || entry.name.trim() === '') {
        v.error(`${entryPath}.name`, 'must be a non-empty string');
      } else if (seen.has(entry.name)) {
        v.error(`${entryPath}.name`, `duplicate template name "${entry.name}"`);
      } else {
        seen.add(entry.name);
      }
      if ('extends' in entry && entry.extends !== 'global') {
        v.error(`${entryPath}.extends`, 'only "global" is supported');
      }
      if ('match' in entry) {
        validateMatch(v, entry.match, `${entryPath}.match`);
      }
      if ('toggles' in entry) {
        const toggles = entry.toggles;
        if (!isPlainObject(toggles)) {
          v.error(`${entryPath}.toggles`, 'must be a mapping of key to on/off');
        } else {
          for (const [tKey, tVal] of Object.entries(toggles)) {
            if (typeof tVal !== 'boolean' && tVal !== 'on' && tVal !== 'off') {
              v.error(`${entryPath}.toggles.${tKey}`, 'must be a boolean or "on"/"off"');
            }
          }
        }
      }
      validateTemplateFields(v, entry, entryPath, SCOPED_TEMPLATE_KEYS);
    });
  }
}

function validateAutomations(v: Validation, value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    v.error(path, 'must be a list of automations');
    return;
  }
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isPlainObject(entry)) {
      v.error(entryPath, 'automation must be a mapping');
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!AUTOMATION_KEYS.has(key)) {
        v.warn(`unknown key "${entryPath}.${key}" ignored`);
      }
    }
    if (typeof entry.name !== 'string' || entry.name.trim() === '') {
      v.error(`${entryPath}.name`, 'must be a non-empty string');
    } else if (seen.has(entry.name)) {
      v.error(`${entryPath}.name`, `duplicate automation name "${entry.name}"`);
    } else {
      seen.add(entry.name);
    }
    if (typeof entry.trigger !== 'string' || !AUTOMATION_TRIGGERS.has(entry.trigger)) {
      v.error(`${entryPath}.trigger`, 'must be one of on-write, on-create, on-rename, pre-commit, ci, schedule, manual');
    }
    for (const [enumKey, allowed] of [
      ['action', AUTOMATION_ACTIONS],
      ['failure', AUTOMATION_FAILURES],
      ['log', AUTOMATION_LOGS],
      ['report', AUTOMATION_REPORTS],
    ] as const) {
      if (enumKey in entry && (typeof entry[enumKey] !== 'string' || !allowed.has(entry[enumKey] as string))) {
        v.error(`${entryPath}.${enumKey}`, `must be one of ${[...allowed].join(', ')}`);
      }
    }
    if ('schedule' in entry && typeof entry.schedule !== 'string') {
      v.error(`${entryPath}.schedule`, 'must be a cron string');
    }
    if (entry.trigger === 'schedule' && typeof entry.schedule !== 'string') {
      v.error(`${entryPath}.schedule`, 'a schedule trigger requires a cron string');
    }
    if ('scope' in entry) {
      validateMatch(v, entry.scope, `${entryPath}.scope`);
    }
  });
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
  if ('templates' in raw) {
    validateTemplates(v, raw.templates, 'templates');
  }
  if ('automations' in raw) {
    validateAutomations(v, raw.automations, 'automations');
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
