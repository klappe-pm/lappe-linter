import {h1MatchesStemRule, registerFilenameRules} from '../../src/filename';
import {_resetRegistryForTests, runRules} from '../../src/index';

const apply = (text: string, path?: string): string =>
  h1MatchesStemRule.apply(text, {}, path === undefined ? undefined : {path});

describe('h1-matches-stem', () => {
  it('rewrites a conflicting first H1 to the stem, preserving everything else', () => {
    const before = '---\ntitle: x\n---\n\n# Wrong Title\n\nBody line.\n\n## Section\n';
    const after = '---\ntitle: x\n---\n\n# my-note\n\nBody line.\n\n## Section\n';
    expect(apply(before, 'notes/my-note.md')).toBe(after);
  });

  it('preserves content before the first H1', () => {
    const before = '---\na: 1\n---\nintro paragraph\n\n# Old Heading\nrest\n';
    const after = '---\na: 1\n---\nintro paragraph\n\n# my-note\nrest\n';
    expect(apply(before, 'my-note.md')).toBe(after);
  });

  it('only rewrites the first H1; later H1s stay', () => {
    const before = '# First\n\n# Second\n';
    expect(apply(before, 'a.md')).toBe('# a\n\n# Second\n');
  });

  it('inserts an H1 after frontmatter when the body has none', () => {
    const before = '---\ntitle: x\n---\nBody.\n';
    const after = '---\ntitle: x\n---\n\n# my-note\n\nBody.\n';
    expect(apply(before, 'dir/sub/my-note.md')).toBe(after);
  });

  it('does not double blank lines when the body already starts blank', () => {
    const before = '---\nt: 1\n---\n\nBody.\n';
    expect(apply(before, 'n.md')).toBe('---\nt: 1\n---\n\n# n\n\nBody.\n');
  });

  it('inserts at the top when there is no frontmatter', () => {
    expect(apply('just text\n', 'my-note.md')).toBe('# my-note\n\njust text\n');
  });

  it('handles an empty file', () => {
    expect(apply('', 'my-note.md')).toBe('# my-note\n');
  });

  it('ignores an H1-looking line inside a code fence', () => {
    const before = '```\n# not a heading\n```\ntext\n';
    const after = '# my-note\n\n```\n# not a heading\n```\ntext\n';
    expect(apply(before, 'my-note.md')).toBe(after);
  });

  it('is a no-op without ctx.path', () => {
    const text = 'no h1 here\n';
    expect(apply(text)).toBe(text);
    expect(h1MatchesStemRule.apply(text, {}, {})).toBe(text);
  });

  it('is idempotent for both rewrite and insert paths', () => {
    const inputs: Array<[string, string]> = [
      ['---\nt: 1\n---\n\n# Wrong\n\nbody\n', 'notes/my-note.md'],
      ['---\nt: 1\n---\nbody\n', 'my-note.md'],
      ['plain body\n', 'my-note.md'],
      ['', 'my-note.md'],
    ];
    for (const [text, path] of inputs) {
      const once = apply(text, path);
      expect(apply(once, path)).toBe(once);
    }
  });

  it('runs through the runner and reports a fixed violation', () => {
    _resetRegistryForTests();
    registerFilenameRules();
    const result = runRules('# Wrong\n', {
      rules: {'h1-matches-stem': {enabled: true}},
      ctx: {path: 'my-note.md'},
    });
    expect(result.text).toBe('# my-note\n');
    expect(result.changed).toBe(true);
    expect(result.violations).toEqual([
      {rule: 'h1-matches-stem', message: h1MatchesStemRule.description, fixed: true},
    ]);
  });
});
