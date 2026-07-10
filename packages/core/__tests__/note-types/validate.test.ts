import {NoteTypeSchema} from '../../src/config/types';
import {
  _resetRegistryForTests,
  runRules,
} from '../../src/index';
import {
  collectNoteTypeViolations,
  noteTypeValidate,
  registerNoteTypeRules,
  starterNoteTypes,
} from '../../src/note-types';

const schema: NoteTypeSchema = starterNoteTypes['project'];

const clean = [
  '---',
  'domain: development',
  'category: linting',
  'sub-category: core',
  'date-created: 2026-07-01',
  'date-revised: 2026-07-01',
  'type: project',
  'status: NEW',
  'aliases:',
  'tags:',
  '  - project',
  '---',
  'Body.',
  '',
].join('\n');

describe('collectNoteTypeViolations', () => {
  it('returns no violations for a clean fixture', () => {
    expect(collectNoteTypeViolations(clean, schema)).toEqual([]);
  });

  it('reports enum violations as key: problem', () => {
    const text = clean.replace('status: NEW', 'status: WIP');
    expect(collectNoteTypeViolations(text, schema)).toEqual([
      'status: value "WIP" is not one of [NEW, DRAFT, INPRG, REVIEW, DONE, ARCHIVED]',
    ]);
  });

  it('checks enum constraints on each list item', () => {
    const listSchema: NoteTypeSchema = {values: {tags: ['a', 'b']}};
    const text = '---\ntags:\n  - a\n  - nope\n---\n';
    expect(collectNoteTypeViolations(text, listSchema)).toEqual([
      'tags: value "nope" is not one of [a, b]',
    ]);
  });

  it('reports nested maps in managed keys', () => {
    const text = clean.replace('status: NEW', 'status:\n  state: NEW');
    expect(collectNoteTypeViolations(text, schema)).toContain(
      'status: nested maps are not allowed in managed keys',
    );
  });

  it('reports list items that are not flat scalars', () => {
    const text = clean.replace('  - project', '  - nested: map');
    expect(collectNoteTypeViolations(text, schema)).toContain(
      'tags: list items must be flat scalars',
    );
  });

  it('reports missing required keys without defaults', () => {
    const text = '---\ntype: project\nstatus: NEW\naliases:\ntags:\n---\nBody.\n';
    const violations = collectNoteTypeViolations(text, schema);
    expect(violations).toContain('domain: required key is missing and has no default');
    expect(violations).toContain('category: required key is missing and has no default');
    expect(violations).toContain('sub-category: required key is missing and has no default');
  });

  it('does not report missing required keys that have defaults', () => {
    const text = '---\ndomain: d\ncategory: c\nsub-category: s\n---\nBody.\n';
    const violations = collectNoteTypeViolations(text, schema);
    expect(violations.filter((v) => v.startsWith('status'))).toEqual([]);
    expect(violations.filter((v) => v.startsWith('tags'))).toEqual([]);
  });
});

describe('note-type-validate rule', () => {
  beforeEach(() => _resetRegistryForTests());

  it('is report-only: text is never mutated and a violation is recorded', () => {
    registerNoteTypeRules();
    const text = clean.replace('status: NEW', 'status: WIP');
    const result = runRules(text, {
      rules: {'note-type-validate': {enabled: true, options: {schema}}},
    });
    expect(result.text).toBe(text);
    expect(result.changed).toBe(false);
    expect(result.violations).toEqual([
      {rule: 'note-type-validate', message: noteTypeValidate.description, fixed: false},
    ]);
  });

  it('records nothing on a clean file', () => {
    registerNoteTypeRules();
    const result = runRules(clean, {
      rules: {'note-type-validate': {enabled: true, options: {schema}}},
    });
    expect(result.violations).toEqual([]);
  });

  it('no-ops when the schema option is absent', () => {
    const text = clean.replace('status: NEW', 'status: WIP');
    expect(noteTypeValidate.apply(text, {})).toBe(text);
  });
});
