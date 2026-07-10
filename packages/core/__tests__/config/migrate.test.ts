import {parseLinterConfig} from '../../src/config/loader';
import {migrateDataJson} from '../../src/config/migrate';

/** Realistic upstream data.json built from src/settings-data.ts DEFAULT_SETTINGS. */
const DATA_JSON = JSON.stringify({
  ruleConfigs: {
    'yaml-key-sort': {
      'enabled': true,
      'yaml-key-priority-sort-order': 'domain\ncategory\nsub-category',
      'priority-keys-at-start-of-yaml': true,
      'yaml-sort-order-for-other-keys': 'Ascending Alphabetical',
    },
    'trailing-spaces': {
      'enabled': true,
      'twp-space-line-break': false,
    },
    'heading-blank-lines': {
      'enabled': false,
      'bottom': true,
      'empty-line-after-yaml': true,
    },
  },
  lintOnSave: true,
  displayChanged: true,
  suppressMessageWhenNoChange: false,
  settingsConvertedToConfigKeyValues: true,
  recordLintOnSaveLogs: false,
  lintOnFileChange: false,
  displayLintOnFileChangeNotice: false,
  additionalFileExtensions: ['txt'],
  foldersToIgnore: ['templates', 'archive'],
  filesToIgnore: [{label: 'daily notes', match: '^daily/', flags: 'i'}],
  linterLocale: 'system-default',
  logLevel: 'ERROR',
  lintCommands: [{id: 'editor:save-file', name: 'Save'}],
  customRegexes: [{label: 'x', find: 'a', replace: 'b', flags: 'g'}],
  commonStyles: {
    aliasArrayStyle: 'single-line',
    tagArrayStyle: 'single-line',
    minimumNumberOfDollarSignsToBeAMathBlock: 2,
    escapeCharacter: '"',
    removeUnnecessaryEscapeCharsForMultiLineArrays: false,
  },
}, null, 2);

describe('migrateDataJson', () => {
  const migrated = migrateDataJson(DATA_JSON);

  it('produces a linter.yaml the loader accepts', () => {
    const result = parseLinterConfig(migrated);
    expect(result.ok).toBe(true);
  });

  it('maps ruleConfigs to defaults.rules with options intact', () => {
    const result = parseLinterConfig(migrated);
    if (!result.ok) return;
    const rules = result.config.defaults?.rules ?? {};
    expect(Object.keys(rules).sort()).toEqual(['heading-blank-lines', 'trailing-spaces', 'yaml-key-sort']);
    expect(rules['yaml-key-sort']?.enabled).toBe(true);
    expect(rules['yaml-key-sort']?.['yaml-key-priority-sort-order']).toBe('domain\ncategory\nsub-category');
    expect(rules['heading-blank-lines']?.enabled).toBe(false);
  });

  it('maps foldersToIgnore to ignore.folders', () => {
    const result = parseLinterConfig(migrated);
    if (!result.ok) return;
    expect(result.config.ignore?.folders).toEqual(['templates', 'archive']);
  });

  it('leaves UI-only state out entirely', () => {
    for (const uiKey of ['lintOnSave', 'logLevel', 'linterLocale', 'displayChanged']) {
      expect(migrated).not.toContain(uiKey);
    }
  });

  it('carries unmappable settings in a commented unmapped block', () => {
    expect(migrated).toContain('# unmapped:');
    for (const key of ['filesToIgnore', 'additionalFileExtensions', 'lintCommands', 'customRegexes', 'commonStyles']) {
      expect(migrated).toMatch(new RegExp(`^# ${key}: `, 'm'));
    }
    expect(migrated).toContain('"match":"^daily/"');
  });

  it('is idempotent: migrating the output changes nothing', () => {
    expect(migrateDataJson(migrated)).toBe(migrated);
  });

  it('handles an empty settings object', () => {
    const out = migrateDataJson('{}');
    const result = parseLinterConfig(out);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.version).toBe(1);
  });

  it('routes malformed rule entries to the unmapped block instead of dropping them', () => {
    const out = migrateDataJson(JSON.stringify({
      ruleConfigs: {'good-rule': {enabled: true}, 'bad-rule': 'oops', 'bad-enabled': {enabled: 'yes'}},
    }));
    const result = parseLinterConfig(out);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.defaults?.rules?.['good-rule']?.enabled).toBe(true);
    expect(result.config.defaults?.rules?.['bad-rule']).toBeUndefined();
    expect(out).toMatch(/^# ruleConfigs\.bad-rule: "oops"$/m);
    expect(out).toMatch(/^# ruleConfigs\.bad-enabled: \{"enabled":"yes"\}$/m);
  });

  it('rejects input that is neither linter.yaml nor JSON', () => {
    expect(() => migrateDataJson('not: [valid json')).toThrow(/neither/);
  });
});
