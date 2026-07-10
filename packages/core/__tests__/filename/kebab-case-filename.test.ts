import {kebabCaseFilenameRule, proposeRename, registerFilenameRules} from '../../src/filename';
import {_resetRegistryForTests, runRules} from '../../src/index';

describe('proposeRename', () => {
  it('proposes the kebab-case stem for a non-compliant path', () => {
    expect(proposeRename('notes/My Note.md')).toEqual({stem: 'My Note', proposed: 'my-note'});
  });

  it('returns null for a compliant stem, a reserved stem, or no path', () => {
    expect(proposeRename('notes/my-note.md')).toBeNull();
    expect(proposeRename('README.md')).toBeNull();
    expect(proposeRename(undefined)).toBeNull();
  });

  it('returns null when the slug degenerates to empty', () => {
    expect(proposeRename('📓.md')).toBeNull();
  });
});

describe('kebab-case-filename rule', () => {
  it('signals a violation whose trailer includes the proposed name', () => {
    const signal = kebabCaseFilenameRule.apply('Body.\n', {}, {path: 'My Note.md'});
    expect(signal).toContain('rename "My Note" to "my-note"');
    expect(signal.startsWith('Body.\n')).toBe(true);
  });

  it('is silent on a compliant stem and without a path', () => {
    expect(kebabCaseFilenameRule.apply('Body.\n', {}, {path: 'my-note.md'})).toBe('Body.\n');
    expect(kebabCaseFilenameRule.apply('Body.\n', {}, {})).toBe('Body.\n');
    expect(kebabCaseFilenameRule.apply('Body.\n', {})).toBe('Body.\n');
  });

  it('reports through the runner without mutating the text', () => {
    _resetRegistryForTests();
    registerFilenameRules();
    const result = runRules('Body.\n', {
      rules: {'kebab-case-filename': {enabled: true}},
      ctx: {path: 'Some_File Name.md'},
    });
    expect(result.text).toBe('Body.\n');
    expect(result.changed).toBe(false);
    expect(result.violations).toEqual([
      {rule: 'kebab-case-filename', message: kebabCaseFilenameRule.description, fixed: false},
    ]);
  });

  it('registerFilenameRules registers exactly the two F04 rules', () => {
    _resetRegistryForTests();
    registerFilenameRules();
    const result = runRules('Body.\n', {rules: {}, ctx: {path: 'my-note.md'}});
    expect(result.changed).toBe(false);
    expect(() => registerFilenameRules()).toThrow(/duplicate/);
  });
});
