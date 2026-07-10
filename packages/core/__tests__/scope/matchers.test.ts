import {compileGlob, compileProfileMatch} from '../../src/scope/matchers';
import {parseFrontmatter} from '../../src/scope/frontmatter';

describe('compileGlob', () => {
  const cases: Array<[glob: string, path: string, expected: boolean]> = [
    ['**', 'a.md', true],
    ['**', 'a/b/c.md', true],
    ['*.md', 'a.md', true],
    ['*.md', 'a/b.md', false],
    ['**/*.md', 'a/b.md', true],
    ['**/*.md', 'a.md', true],
    ['notes/**', 'notes/a.md', true],
    ['notes/**', 'notes/deep/nested/a.md', true],
    ['notes/**', 'other/a.md', false],
    ['notes/**', 'notes', true],
    ['notes/**/tasks/*.md', 'notes/tasks/a.md', true],
    ['notes/**/tasks/*.md', 'notes/x/y/tasks/a.md', true],
    ['notes/**/tasks/*.md', 'notes/tasks/deep/a.md', false],
    ['notes/*/a.md', 'notes/x/a.md', true],
    ['notes/*/a.md', 'notes/x/y/a.md', false],
    ['a?c.md', 'abc.md', true],
    ['a?c.md', 'ac.md', false],
    ['a?c.md', 'abbc.md', false],
    ['docs/*.md', 'docs/read.me.md', true],
    ['docs/*.txt', 'docs/read.md', false],
    ['a+b/*.md', 'a+b/x.md', true],
    ['a.b/c.md', 'axb/c.md', false],
  ];

  it.each(cases)('glob %s vs %s => %s', (glob, path, expected) => {
    expect(compileGlob(glob).test(path)).toBe(expected);
  });

  it('depth counts /-separated segments', () => {
    expect(compileGlob('**').depth).toBe(1);
    expect(compileGlob('notes/**').depth).toBe(2);
    expect(compileGlob('notes/projects/*.md').depth).toBe(3);
  });
});

describe('compileProfileMatch', () => {
  const fm = (raw: string) => parseFrontmatter(raw);

  it('extension matches case-insensitively and requires a real extension', () => {
    const m = compileProfileMatch({extension: ['md']});
    expect(m.evaluate('a/b.MD', null).matched).toBe(true);
    expect(m.evaluate('a/b.txt', null).matched).toBe(false);
    expect(m.evaluate('a/noext', null).matched).toBe(false);
    expect(m.evaluate('a/.gitignore', null).matched).toBe(false);
  });

  it('frontmatter exact match on scalars', () => {
    const m = compileProfileMatch({frontmatter: {type: 'project', priority: 2, draft: true}});
    expect(m.evaluate('a.md', fm('type: project\npriority: 2\ndraft: true')).matched).toBe(true);
    expect(m.evaluate('a.md', fm('type: project\npriority: 3\ndraft: true')).matched).toBe(false);
    expect(m.evaluate('a.md', fm('type: project')).matched).toBe(false);
    expect(m.evaluate('a.md', null).matched).toBe(false);
  });

  it('frontmatter scalar predicate matches list-contains', () => {
    const m = compileProfileMatch({frontmatter: {aliases: 'scope engine'}});
    expect(m.evaluate('a.md', fm('aliases:\n  - scope engine\n  - other')).matched).toBe(true);
    expect(m.evaluate('a.md', fm('aliases:\n  - other')).matched).toBe(false);
  });

  it('frontmatter array predicate requires every element contained', () => {
    const m = compileProfileMatch({frontmatter: {tags: ['a', 'b']}});
    expect(m.evaluate('x.md', fm('tags:\n  - a\n  - b\n  - c')).matched).toBe(true);
    expect(m.evaluate('x.md', fm('tags:\n  - a')).matched).toBe(false);
    expect(m.evaluate('x.md', fm('tags: a')).matched).toBe(false);
  });

  it('tag matcher normalizes # and accepts string or list tags', () => {
    const m = compileProfileMatch({tag: ['#work']});
    expect(m.evaluate('x.md', fm('tags:\n  - work')).matched).toBe(true);
    expect(m.evaluate('x.md', fm('tags: work, home')).matched).toBe(true);
    expect(m.evaluate('x.md', fm('tag: "#work"')).matched).toBe(true);
    expect(m.evaluate('x.md', fm('tags:\n  - play')).matched).toBe(false);
    expect(m.evaluate('x.md', null).matched).toBe(false);
  });

  it('ANDs across kinds, ORs within a kind', () => {
    const m = compileProfileMatch({
      extension: ['md', 'canvas'],
      path: ['notes/**', 'docs/**'],
      frontmatter: {type: 'task'},
    });
    expect(m.evaluate('notes/a.md', fm('type: task')).matched).toBe(true);
    expect(m.evaluate('docs/a.canvas', fm('type: task')).matched).toBe(true);
    expect(m.evaluate('other/a.md', fm('type: task')).matched).toBe(false);
    expect(m.evaluate('notes/a.md', fm('type: note')).matched).toBe(false);
    expect(m.evaluate('notes/a.txt', fm('type: task')).matched).toBe(false);
  });

  it('reports the deepest matched glob depth', () => {
    const m = compileProfileMatch({path: ['notes/**', 'notes/projects/**']});
    expect(m.evaluate('notes/projects/a.md', null)).toEqual({matched: true, pathDepth: 3});
    expect(m.evaluate('notes/a.md', null)).toEqual({matched: true, pathDepth: 2});
  });

  it('an empty match never matches', () => {
    const m = compileProfileMatch({});
    expect(m.rank).toBe(0);
    expect(m.evaluate('a.md', fm('type: x')).matched).toBe(false);
  });
});

describe('parseFrontmatter', () => {
  it('parses a mapping into a flat record', () => {
    expect(parseFrontmatter('type: task\nnums:\n  - 1\n  - 2')).toEqual({
      type: 'task',
      nums: [1, 2],
    });
  });

  it('returns null for absent, blank, malformed, or non-mapping input', () => {
    expect(parseFrontmatter(null)).toBeNull();
    expect(parseFrontmatter('')).toBeNull();
    expect(parseFrontmatter('   \n')).toBeNull();
    expect(parseFrontmatter('key: [unclosed')).toBeNull();
    expect(parseFrontmatter('just a scalar')).toEqual(null);
    expect(parseFrontmatter('- a\n- b')).toBeNull();
    expect(parseFrontmatter('a: 1\n  bad indent: 2')).toBeNull();
  });
});
