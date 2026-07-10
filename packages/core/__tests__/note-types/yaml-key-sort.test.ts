import {yamlKeySort} from '../../src/note-types/yaml-key-sort';

const OPTS = {'priority-keys': ['domain', 'category', 'sub-category', 'date-created', 'date-revised']};

describe('yaml-key-sort (global)', () => {
  it('sorts priority keys first, remaining alphabetical, aliases and tags last', () => {
    const before = '---\ntags:\n  - x\nstatus: DRAFT\naliases:\n  - a\ncategory: notes\ndomain: development\nbeta: 1\n---\nBody.\n';
    const after = yamlKeySort.apply(before, OPTS);
    expect(after).toBe('---\ndomain: development\ncategory: notes\nbeta: 1\nstatus: DRAFT\naliases:\n  - a\ntags:\n  - x\n---\nBody.\n');
  });

  it('is idempotent', () => {
    const before = '---\ntags:\n  - x\nstatus: DRAFT\ndomain: development\n---\nBody.\n';
    const once = yamlKeySort.apply(before, OPTS);
    expect(yamlKeySort.apply(once, OPTS)).toBe(once);
  });

  it('inserts configured defaults at ranked position without overwriting', () => {
    const before = '---\ndomain: development\nstatus: REVIEW\n---\nBody.\n';
    const after = yamlKeySort.apply(before, {
      'priority-keys': ['domain', 'category'],
      'defaults': {category: 'notes', status: 'DRAFT'},
    });
    expect(after).toBe('---\ndomain: development\ncategory: notes\nstatus: REVIEW\n---\nBody.\n');
  });

  it('no-ops on files without frontmatter and on invalid yaml', () => {
    expect(yamlKeySort.apply('Just a body.\n', OPTS)).toBe('Just a body.\n');
    const invalid = '---\n[not: a mapping\n---\nBody.\n';
    expect(yamlKeySort.apply(invalid, OPTS)).toBe(invalid);
  });

  it('keeps multi-line entries attached to their key and preserves the body', () => {
    const before = '---\nzeta: 1\nlist:\n  - one\n  - two\ndomain: d\n---\nBody stays.\n';
    const after = yamlKeySort.apply(before, {'priority-keys': ['domain']});
    expect(after).toBe('---\ndomain: d\nlist:\n  - one\n  - two\nzeta: 1\n---\nBody stays.\n');
  });

  it('every documented example holds and is idempotent', () => {
    for (const example of yamlKeySort.examples ?? []) {
      const out = yamlKeySort.apply(example.before, example.options ?? {});
      expect(out).toBe(example.after);
      expect(yamlKeySort.apply(out, example.options ?? {})).toBe(out);
    }
  });
});
