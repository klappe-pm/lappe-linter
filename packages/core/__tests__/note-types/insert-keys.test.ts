import {NoteTypeSchema} from '../../src/config/types';
import {noteTypeInsertKeys} from '../../src/note-types';
import {starterNoteTypes} from '../../src/note-types';

const apply = (text: string, schema?: NoteTypeSchema) =>
  noteTypeInsertKeys.apply(text, schema ? {schema} : {});

describe('note-type-insert-keys', () => {
  const schema = starterNoteTypes['task'];

  it('inserts required keys with defaults when absent', () => {
    const before = '---\ndomain: development\n---\n# t\n\nBody.\n';
    const after = apply(before, schema);
    expect(after).toBe(
        '---\ndomain: development\ntype: task\nstatus: NEW\naliases:\ntags:\n---\n# t\n\nBody.\n',
    );
  });

  it('never overwrites existing values', () => {
    const before = '---\ndomain: development\ntype: task\nstatus: DONE\naliases:\ntags:\n  - keep\n---\nBody.\n';
    expect(apply(before, schema)).toBe(before);
  });

  it('does not insert required keys whose default is null', () => {
    const after = apply('---\ntype: task\n---\nBody.\n', schema);
    expect(after).not.toContain('domain:');
    expect(after).not.toContain('sub-category:');
  });

  it('renders empty array defaults as key: with no []', () => {
    const after = apply('---\ntype: task\n---\nBody.\n', schema);
    expect(after).toContain('\naliases:\n');
    expect(after).toContain('\ntags:\n');
    expect(after).not.toContain('[]');
  });

  it('renders non-empty list defaults as block sequences', () => {
    const after = apply('---\ntitle: x\n---\nBody.\n', {
      required: {tags: ['daily', 'log']},
    });
    expect(after).toContain('tags:\n  - daily\n  - log');
  });

  it('creates frontmatter on a file without one, body byte-identical', () => {
    const body = '# Title\n\nBody with  trailing spaces  \nand more.\n';
    const after = apply(body, schema);
    expect(after).toBe(`---\ntype: task\nstatus: NEW\naliases:\ntags:\n---\n${body}`);
  });

  it('no-ops when the schema option is absent', () => {
    const before = '# Title\n\nBody.\n';
    expect(apply(before)).toBe(before);
  });

  it('no-ops on invalid YAML frontmatter', () => {
    const before = '---\nkey: [unclosed\n---\nBody.\n';
    expect(apply(before, schema)).toBe(before);
  });

  it('is idempotent: second run yields zero diff', () => {
    const once = apply('# Title\n\nBody.\n', schema);
    expect(apply(once, schema)).toBe(once);
  });
});
