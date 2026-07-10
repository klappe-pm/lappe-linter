import {alphabetizePropertyValues} from '../../src/note-types/alphabetize-property-values';
import {yamlTimestamp} from '../../src/note-types/yaml-timestamp';
import {defaultLinterConfig, mergeStyleFiles} from '../../src/config/defaults';
import {lintText} from '../../src/lint-file';
import {registerAllRules} from '../../src/index';

describe('alphabetize-property-values', () => {
  it('sorts block-sequence values case-insensitively, keys untouched', () => {
    const before = '---\ntags:\n  - Zeta\n  - alpha\nstatus: DRAFT\n---\nBody.\n';
    expect(alphabetizePropertyValues.apply(before, {})).toBe(
        '---\ntags:\n  - alpha\n  - Zeta\nstatus: DRAFT\n---\nBody.\n',
    );
  });

  it('sorts simple flow arrays and skips nested or quoted ones', () => {
    const flow = '---\naliases: [second, first]\n---\n';
    expect(alphabetizePropertyValues.apply(flow, {})).toBe('---\naliases: [first, second]\n---\n');
    const quoted = '---\naliases: ["b, a", c]\n---\n';
    expect(alphabetizePropertyValues.apply(quoted, {})).toBe(quoted);
  });

  it('is idempotent and honors its documented example', () => {
    for (const example of alphabetizePropertyValues.examples ?? []) {
      const out = alphabetizePropertyValues.apply(example.before, {});
      expect(out).toBe(example.after);
      expect(alphabetizePropertyValues.apply(out, {})).toBe(out);
    }
  });
});

describe('yaml-timestamp (global, mandatory)', () => {
  it('honors its documented example and is churn-guarded', () => {
    for (const example of yamlTimestamp.examples ?? []) {
      const out = yamlTimestamp.apply(example.before, example.options ?? {});
      expect(out).toBe(example.after);
    }
    const clean = '---\ndomain: d\ndate-created: 2026-01-01\ndate-revised: 2026-01-01\n---\nBody.\n';
    const opts = {
      schema: {'date-keys': {created: 'date-created', revised: 'date-revised'}},
      today: '2026-07-10',
      originalText: clean,
    };
    expect(yamlTimestamp.apply(clean, opts)).toBe(clean);
  });
});

describe('default config end to end', () => {
  it('lintText with compiled defaults sorts keys, values, and stamps dates', () => {
    registerAllRules();
    const result = lintText({
      text: '---\ntags:\n  - z\n  - a\nstatus: DRAFT\ndomain: d\n---\n# wrong\n\nBody.\n',
      path: 'notes/some-note.md',
      config: defaultLinterConfig(),
      today: '2026-07-10',
    });
    expect(result.text).toBe(
        '---\ndomain: d\ndate-created: 2026-07-10\ndate-revised: 2026-07-10\nstatus: DRAFT\ntags:\n  - a\n  - z\n---\n# some-note\n\nBody.\n',
    );
    const second = lintText({text: result.text, path: 'notes/some-note.md', config: defaultLinterConfig(), today: '2026-07-10'});
    expect(second.text).toBe(result.text);
  });
});

describe('style files merge', () => {
  it('merges style fragments as profiles with linter.yaml winning conflicts', () => {
    const config = {...defaultLinterConfig(), profiles: {work: {rules: {'strip-strong': {enabled: true}}}}};
    const merged = mergeStyleFiles(config, [
      {name: 'journal', text: 'match:\n  path:\n    - journal/**\nrules:\n  join-paragraph-lines:\n    enabled: true\n'},
      {name: 'work', text: 'rules:\n  strip-strong:\n    enabled: false\n'},
    ]);
    expect(merged.errors).toEqual([]);
    expect(merged.config.profiles?.['journal']?.match?.path).toEqual(['journal/**']);
    expect(merged.config.profiles?.['work']?.rules?.['strip-strong']?.enabled).toBe(true);
  });

  it('reports invalid style files without failing the rest', () => {
    const merged = mergeStyleFiles(defaultLinterConfig(), [
      {name: 'bad', text: 'rules: [not, a, map]\n'},
      {name: 'good', text: 'rules:\n  strip-strong:\n    enabled: true\n'},
    ]);
    expect(merged.errors.length).toBe(1);
    expect(merged.errors[0].name).toBe('bad');
    expect(merged.config.profiles?.['good']).toBeDefined();
  });
});
