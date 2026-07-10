import {parseLinterConfig} from '../../src/config/loader';
import {resolveProfile} from '../../src/scope/resolver';
import {LinterConfig} from '../../src/config/types';

function config(yaml: string): LinterConfig {
  const result = parseLinterConfig(yaml);
  if (!result.ok) {
    throw new Error('config failed to parse: ' + JSON.stringify(result.errors));
  }
  return result.config;
}

describe('advanced scope matchers end to end', () => {
  it('accepts and applies an age profile', () => {
    const cfg = config([
      'version: 1',
      'profiles:',
      '  fresh:',
      '    match:',
      '      age: ["1-5"]',
      '    rules:',
      '      strip-strong: {enabled: true}',
      '',
    ].join('\n'));
    const fresh = resolveProfile(
        {path: 'n.md', frontmatter: 'date-created: 2026-07-08', today: '2026-07-10'},
        cfg,
    );
    expect(fresh.chain).toContain('fresh');
    const old = resolveProfile(
        {path: 'n.md', frontmatter: 'date-created: 2026-01-01', today: '2026-07-10'},
        cfg,
    );
    expect(old.chain).not.toContain('fresh');
  });

  it('accepts and applies a date-created range profile', () => {
    const cfg = config([
      'version: 1',
      'profiles:',
      '  q1:',
      '    match:',
      '      date-created: {after: "2026-01-01", before: "2026-03-31"}',
      '    rules: {}',
      '',
    ].join('\n'));
    const inRange = resolveProfile({path: 'n.md', frontmatter: 'date-created: 2026-02-10'}, cfg);
    expect(inRange.chain).toContain('q1');
    const outRange = resolveProfile({path: 'n.md', frontmatter: 'date-created: 2026-05-10'}, cfg);
    expect(outRange.chain).not.toContain('q1');
  });

  it('applies a backlink profile only when the host provides context', () => {
    const cfg = config([
      'version: 1',
      'profiles:',
      '  linked:',
      '    match:',
      '      backlink: ["index"]',
      '    rules: {}',
      '',
    ].join('\n'));
    const withContext = resolveProfile({path: 'n.md', frontmatter: null, backlinks: ['index', 'other']}, cfg);
    expect(withContext.chain).toContain('linked');
    const noContext = resolveProfile({path: 'n.md', frontmatter: null}, cfg);
    expect(noContext.chain).not.toContain('linked');
  });

  it('errors on a malformed date range', () => {
    const result = parseLinterConfig([
      'version: 1',
      'profiles:',
      '  bad:',
      '    match:',
      '      date-created: "2026-01-01"',
      '    rules: {}',
      '',
    ].join('\n'));
    expect(result.ok).toBe(false);
  });
});
