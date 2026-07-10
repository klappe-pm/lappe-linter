import {parseLinterConfig} from '../src/config/loader';
import {resolveProfile} from '../src/scope/resolver';
import {lintText} from '../src/lint-file';
import {registerAllRules} from '../src/index';
import {LinterConfig} from '../src/config/types';

function config(yaml: string): LinterConfig {
  const result = parseLinterConfig(yaml);
  if (!result.ok) {
    throw new Error('parse failed: ' + JSON.stringify(result.errors));
  }
  return result.config;
}

describe('rule-order', () => {
  beforeAll(() => registerAllRules());

  it('resolves the global rule order', () => {
    const cfg = config(['version: 1', 'rule-order: [list-style, header-case]', ''].join('\n'));
    const resolved = resolveProfile({path: 'n.md', frontmatter: null}, cfg);
    expect(resolved.ruleOrder).toEqual(['list-style', 'header-case']);
  });

  it('lets a matching profile override the global order', () => {
    const cfg = config([
      'version: 1',
      'rule-order: [header-case]',
      'profiles:',
      '  work:',
      '    match: {path: ["work/**"]}',
      '    rule-order: [list-style, paragraph-spacing]',
      '    rules: {}',
      '',
    ].join('\n'));
    const inWork = resolveProfile({path: 'work/n.md', frontmatter: null}, cfg);
    expect(inWork.ruleOrder).toEqual(['list-style', 'paragraph-spacing']);
    const elsewhere = resolveProfile({path: 'other/n.md', frontmatter: null}, cfg);
    expect(elsewhere.ruleOrder).toEqual(['header-case']);
  });

  it('rejects a non-list rule-order', () => {
    expect(parseLinterConfig(['version: 1', 'rule-order: nope', ''].join('\n')).ok).toBe(false);
  });

  it('runs without error when a configured order names an unknown or disabled rule', () => {
    const cfg = config([
      'version: 1',
      'rule-order: [does-not-exist, yaml-key-sort]',
      'defaults:',
      '  rules:',
      '    yaml-key-sort: {enabled: true, priority-keys: [domain]}',
      '',
    ].join('\n'));
    const result = lintText({text: '---\ndomain: d\n---\n# n\n', path: 'n.md', config: cfg, today: '2026-07-10'});
    expect(result.text).toContain('domain: d');
  });
});
