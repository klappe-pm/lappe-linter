import {NoteTypeSchema} from '../../src/config/types';
import {_resetRegistryForTests, getRules, runRules} from '../../src/index';
import {registerNoteTypeRules, starterNoteTypes} from '../../src/note-types';

const TODAY = '2026-07-10';
const TYPES = ['project', 'feature', 'epic', 'task', 'daily', 'reference'];

function lint(text: string, schema: NoteTypeSchema) {
  return runRules(text, {
    rules: {
      'note-type-insert-keys': {enabled: true, options: {schema}},
      'note-type-key-sort': {enabled: true, options: {schema}},
      'note-type-date-keys': {enabled: true, options: {schema, today: TODAY, originalText: text}},
      'note-type-validate': {enabled: true, options: {schema}},
    },
  });
}

describe('starter note-type pipeline', () => {
  beforeEach(() => {
    _resetRegistryForTests();
    registerNoteTypeRules();
  });

  it('registers the frontmatter and note-type rules, once, idempotently', () => {
    registerNoteTypeRules();
    expect(getRules().map((rule) => rule.id)).toEqual([
      'yaml-key-sort',
      'alphabetize-property-values',
      'yaml-timestamp',
      'note-type-insert-keys',
      'note-type-key-sort',
      'note-type-date-keys',
      'note-type-validate',
    ]);
    expect(getRules().every((rule) => rule.category === 'note-type' || rule.category === 'frontmatter')).toBe(true);
  });

  for (const type of TYPES) {
    it(`${type}: full pipeline is idempotent, second run yields zero diff`, () => {
      const schema = starterNoteTypes[type];
      const raw = [
        '---',
        'tags:',
        '  - seed',
        `type: ${type}`,
        'domain: development',
        '---',
        `# ${type} fixture`,
        '',
        'Body.',
        '',
      ].join('\n');
      const first = lint(raw, schema);
      expect(first.changed).toBe(true);
      const second = lint(first.text, schema);
      expect(second.text).toBe(first.text);
      expect(second.changed).toBe(false);
    });

    it(`${type}: first lint produces the house key order with date keys set`, () => {
      const schema = starterNoteTypes[type];
      const raw = `---\ntype: ${type}\ndomain: development\n---\nBody.\n`;
      const result = lint(raw, schema);
      expect(result.text).toBe([
        '---',
        'domain: development',
        `date-created: ${TODAY}`,
        `date-revised: ${TODAY}`,
        `type: ${type}`,
        'status: NEW',
        'aliases:',
        'tags:',
        '---',
        'Body.',
        '',
      ].join('\n'));
    });
  }

  it('lint of an already-clean file leaves it byte-identical with no fix violations', () => {
    const schema = starterNoteTypes['task'];
    const raw = '---\ntype: task\ndomain: development\n---\nBody.\n';
    const clean = lint(raw, schema).text;
    const again = lint(clean, schema);
    expect(again.text).toBe(clean);
    expect(again.changed).toBe(false);
    expect(again.violations.filter((v) => v.fixed)).toEqual([]);
  });
});
