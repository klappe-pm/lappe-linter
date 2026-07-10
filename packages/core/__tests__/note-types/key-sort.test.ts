import {NoteTypeSchema} from '../../src/config/types';
import {noteTypeKeySort, starterNoteTypes} from '../../src/note-types';

const apply = (text: string, schema?: NoteTypeSchema) =>
  noteTypeKeySort.apply(text, schema ? {schema} : {});

const scrambled = (type: string) => [
  '---',
  'tags:',
  '  - x',
  'status: DRAFT',
  'date-revised: 2026-07-01',
  `type: ${type}`,
  'aliases:',
  '  - alt name',
  'category: obsidian-linter-fork',
  'date-created: 2026-06-30',
  'sub-category: feature',
  'domain: development',
  '---',
  `# ${type} note`,
  '',
  'Body.',
  '',
].join('\n');

const expected = (type: string) => [
  '---',
  'domain: development',
  'category: obsidian-linter-fork',
  'sub-category: feature',
  'date-created: 2026-06-30',
  'date-revised: 2026-07-01',
  `type: ${type}`,
  'status: DRAFT',
  'aliases:',
  '  - alt name',
  'tags:',
  '  - x',
  '---',
  `# ${type} note`,
  '',
  'Body.',
  '',
].join('\n');

describe('note-type-key-sort', () => {
  for (const type of ['project', 'feature', 'epic', 'task']) {
    it(`orders ${type} frontmatter per the starter key-order`, () => {
      const schema = starterNoteTypes[type];
      const once = apply(scrambled(type), schema);
      expect(once).toBe(expected(type));
    });

    it(`is idempotent for ${type}: second run yields zero diff`, () => {
      const schema = starterNoteTypes[type];
      const once = apply(scrambled(type), schema);
      expect(apply(once, schema)).toBe(once);
    });
  }

  it('puts unknown extra keys after the key-order block, alphabetically', () => {
    const before = '---\nzeta: 1\ntype: task\nbeta: 2\ndomain: d\n---\nBody.\n';
    const after = apply(before, starterNoteTypes['task']);
    expect(after).toBe('---\ndomain: d\ntype: task\nbeta: 2\nzeta: 1\n---\nBody.\n');
  });

  it('applies the global default order when the schema has no key-order: aliases and tags last', () => {
    const before = [
      '---',
      'tags:',
      '  - t',
      'zebra: z',
      'date-created: 2026-01-01',
      'aliases:',
      'domain: d',
      'apple: a',
      '---',
      'Body.',
      '',
    ].join('\n');
    const after = apply(before, {});
    expect(after).toBe([
      '---',
      'domain: d',
      'date-created: 2026-01-01',
      'apple: a',
      'zebra: z',
      'aliases:',
      'tags:',
      '  - t',
      '---',
      'Body.',
      '',
    ].join('\n'));
  });

  it('keeps multi-line values attached to their key', () => {
    const before = '---\ntags:\n  - one\n  - two\ndomain: d\n---\nBody.\n';
    const after = apply(before, {});
    expect(after).toBe('---\ndomain: d\ntags:\n  - one\n  - two\n---\nBody.\n');
  });

  it('leaves the body untouched byte-for-byte', () => {
    const body = 'Line with trailing space \n\n\ttabbed\n--- not a fence\n';
    const before = `---\ntags:\ndomain: d\n---\n${body}`;
    expect(apply(before, {})).toBe(`---\ndomain: d\ntags:\n---\n${body}`);
  });

  it('no-ops without frontmatter or without schema', () => {
    expect(apply('# no fm\n', {})).toBe('# no fm\n');
    expect(apply('---\nb: 1\na: 2\n---\n')).toBe('---\nb: 1\na: 2\n---\n');
  });
});
