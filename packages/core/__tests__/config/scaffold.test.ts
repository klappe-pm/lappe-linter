import {parseLinterConfig} from '../../src/config/loader';
import {scaffoldConfig} from '../../src/config/scaffold';

describe('scaffoldConfig', () => {
  const text = scaffoldConfig();
  const result = parseLinterConfig(text);

  it('parses clean through the loader', () => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });

  it('carries the spec defaults', () => {
    if (!result.ok) return;
    expect(result.config.version).toBe(1);
    expect(result.config.defaults?.rules?.['yaml-key-sort']?.enabled).toBe(true);
    expect(result.config.defaults?.rules?.['yaml-key-sort']?.['priority-keys']).toEqual([
      'domain', 'category', 'sub-category', 'date-created', 'date-revised',
    ]);
    expect(result.config.profiles?.['tasks-notes']).toBeDefined();
    expect(result.config['note-types']).toEqual({});
    expect(result.config.rename?.mode).toBe('flag');
    expect(result.config.ignore?.folders).toEqual([]);
    expect(result.config.ignore?.files).toEqual([]);
  });

  it('documents the canonical filename and its alias (dec-002)', () => {
    expect(text).toContain('linter.yaml');
    expect(text).toContain('lappe-linter.yaml');
    expect(text).toContain('linter.yaml wins');
  });

  it('comments every default inline', () => {
    const settingLines = text.split('\n').filter((line) => /^\s*[\w-]+:/.test(line) && !line.trim().endsWith(':'));
    const uncommented = settingLines.filter((line) => !line.includes('#'));
    expect(uncommented).toEqual([]);
  });
});
