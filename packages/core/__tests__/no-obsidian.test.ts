import {readdirSync, readFileSync, statSync} from 'fs';
import {join} from 'path';
import {
  _resetRegistryForTests,
  getRules,
  registerRule,
  runRules,
} from '../src/index';

const CORE_SRC = join(__dirname, '..', 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (full.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('core is Obsidian-free', () => {
  it('no source file under packages/core/src imports from obsidian', () => {
    const offenders = walk(CORE_SRC).filter((file) => {
      const src = readFileSync(file, 'utf8');
      // Match real module bindings only, not prose that names the package.
      return /^\s*import\b[^\n]*\bfrom\s*['"]obsidian['"]/m.test(src) ||
        /\brequire\(\s*['"]obsidian['"]\s*\)/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});

describe('core rule engine', () => {
  beforeEach(() => _resetRegistryForTests());

  it('registers and runs a pure rule deterministically', () => {
    registerRule({
      id: 'shout',
      category: 'content',
      description: 'uppercase the text',
      apply: (text) => text.toUpperCase(),
    });
    const cfg = {rules: {shout: {enabled: true}}};
    const first = runRules('hi', cfg);
    const second = runRules('hi', cfg);
    expect(first.text).toBe('HI');
    expect(first.changed).toBe(true);
    expect(first.violations).toEqual([{rule: 'shout', message: 'uppercase the text', fixed: true}]);
    expect(second).toEqual(first);
  });

  it('leaves text untouched when a rule is not enabled', () => {
    registerRule({id: 'shout', category: 'content', description: 'x', apply: (t) => t.toUpperCase()});
    const result = runRules('hi', {rules: {}});
    expect(result.text).toBe('hi');
    expect(result.changed).toBe(false);
  });

  it('rejects duplicate rule ids', () => {
    registerRule({id: 'dup', category: 'content', description: 'x', apply: (t) => t});
    expect(() => registerRule({id: 'dup', category: 'content', description: 'y', apply: (t) => t})).toThrow(/duplicate/);
  });

  it('report-only rules record a violation without mutating text', () => {
    registerRule({
      id: 'has-tab',
      category: 'content',
      description: 'file should not contain tabs',
      reportOnly: true,
      apply: (text) => text.replace(/\t/g, '  '),
    });
    const result = runRules('a\tb', {rules: {}, only: ['has-tab']});
    expect(result.text).toBe('a\tb');
    expect(result.violations).toEqual([{rule: 'has-tab', message: 'file should not contain tabs', fixed: false}]);
  });
});

describe('registry isolation', () => {
  it('starts empty after reset', () => {
    _resetRegistryForTests();
    expect(getRules()).toEqual([]);
  });
});
