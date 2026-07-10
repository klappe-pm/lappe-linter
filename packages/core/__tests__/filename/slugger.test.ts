import {isReservedStem, kebabCaseName, resolveCollision} from '../../src/filename';

describe('kebabCaseName', () => {
  const cases: Array<[string, string]> = [
    ['My Note', 'my-note'],
    ['already-kebab', 'already-kebab'],
    ['foo_bar_baz', 'foo-bar-baz'],
    ['mixed_Case Name', 'mixed-case-name'],
    ['camelCaseName', 'camel-case-name'],
    ['HTTPServerNotes', 'http-server-notes'],
    ['file2Name', 'file2-name'],
    ['Café Menu', 'cafe-menu'],
    ['ÉclairRecipe', 'eclair-recipe'],
    ['Señor Über', 'senor-uber'],
    ['notes 📓 stuff', 'notes-stuff'],
    ['🎉party🎉', 'party'],
    ['a  --  b', 'a-b'],
    ['a___b   c', 'a-b-c'],
    ['  __hello__  ', 'hello'],
    ['---edge---', 'edge'],
    ['!!!Hello, World!!!', 'hello-world'],
    ["Kevin's Notes", 'kevins-notes'],
    ['v3.0.0', 'v300'],
    ['', ''],
    ['📓', ''],
  ];

  it.each(cases)('%j -> %j', (input, expected) => {
    expect(kebabCaseName(input)).toBe(expected);
  });

  it('is idempotent', () => {
    for (const [input] of cases) {
      const once = kebabCaseName(input);
      expect(kebabCaseName(once)).toBe(once);
    }
  });

  const reserved = ['README', 'CLAUDE', 'SKILL', 'PASSOFF', 'GIT-STRATEGY', 'PR-STANDARDS', 'MEMORY', 'AGENTS', 'CODEX'];

  it.each(reserved.map((r) => [r]))('reserved stem %j passes through unchanged', (stem) => {
    expect(isReservedStem(stem)).toBe(true);
    expect(kebabCaseName(stem)).toBe(stem);
  });

  it('reserved match is case-sensitive and exact', () => {
    expect(kebabCaseName('Readme')).toBe('readme');
    expect(kebabCaseName('readme')).toBe('readme');
    expect(kebabCaseName('README NOTES')).toBe('readme-notes');
    expect(isReservedStem('readme')).toBe(false);
  });
});

describe('resolveCollision', () => {
  it('returns the proposed stem when free', () => {
    expect(resolveCollision('note', new Set())).toBe('note');
  });

  it('appends -2 on first collision', () => {
    expect(resolveCollision('note', new Set(['note']))).toBe('note-2');
  });

  it('walks past occupied suffixes', () => {
    expect(resolveCollision('note', new Set(['note', 'note-2', 'note-3']))).toBe('note-4');
  });

  it('fills a gap in the suffix sequence', () => {
    expect(resolveCollision('note', new Set(['note', 'note-3']))).toBe('note-2');
  });
});
