import {NoteTypeSchema} from '../../src/config/types';
import {noteTypeDateKeys, starterNoteTypes} from '../../src/note-types';

const schema: NoteTypeSchema = starterNoteTypes['task'];
const TODAY = '2026-07-10';

const apply = (text: string, originalText: string, today: string | undefined = TODAY) =>
  noteTypeDateKeys.apply(text, {schema, today, originalText});

describe('note-type-date-keys', () => {
  it('sets date-created on first lint when absent', () => {
    const before = '---\ndomain: d\ntype: task\n---\nBody.\n';
    const after = apply(before, before);
    expect(after).toContain(`date-created: ${TODAY}`);
  });

  it('inserts date keys at their key-order position', () => {
    const before = '---\ndomain: d\ntype: task\nstatus: NEW\n---\nBody.\n';
    const after = apply(before, before);
    expect(after).toBe(
      `---\ndomain: d\ndate-created: ${TODAY}\ndate-revised: ${TODAY}\ntype: task\nstatus: NEW\n---\nBody.\n`,
    );
  });

  it('churn guard: an already-clean file is returned byte-identical', () => {
    const clean = [
      '---',
      'domain: d',
      'date-created: 2026-06-30',
      'date-revised: 2026-07-01',
      'type: task',
      'status: NEW',
      '---',
      'Body.',
      '',
    ].join('\n');
    expect(apply(clean, clean)).toBe(clean);
  });

  it('updates date-revised when the run changed other content', () => {
    const original = '---\ndate-created: 2026-06-30\ndate-revised: 2026-07-01\ntype: task\n---\nOld body.\n';
    const current = '---\ndate-created: 2026-06-30\ndate-revised: 2026-07-01\ntype: task\n---\nNew body.\n';
    const after = apply(current, original);
    expect(after).toContain(`date-revised: ${TODAY}`);
    expect(after).toContain('New body.');
  });

  it('does not update date-revised when only the date-revised line differs', () => {
    const original = '---\ndate-created: 2026-06-30\ndate-revised: 2026-07-01\ntype: task\n---\nBody.\n';
    const current = '---\ndate-created: 2026-06-30\ndate-revised: 2026-07-05\ntype: task\n---\nBody.\n';
    expect(apply(current, original)).toBe(current);
  });

  it('inserting date-created counts as a change and bumps date-revised', () => {
    const before = '---\ndate-revised: 2026-07-01\ntype: task\n---\nBody.\n';
    const after = apply(before, before);
    expect(after).toContain(`date-created: ${TODAY}`);
    expect(after).toContain(`date-revised: ${TODAY}`);
    expect(after).not.toContain('date-revised: 2026-07-01');
  });

  it('creates frontmatter with date keys on a file without one', () => {
    const body = '# Title\n\nBody.\n';
    const after = apply(body, body);
    expect(after).toBe(`---\ndate-created: ${TODAY}\ndate-revised: ${TODAY}\n---\n${body}`);
  });

  it('no-ops without a today option', () => {
    const before = '---\ntype: task\n---\nBody.\n';
    expect(noteTypeDateKeys.apply(before, {schema, originalText: before})).toBe(before);
  });

  it('no-ops without a schema option', () => {
    const before = '---\ntype: task\n---\nBody.\n';
    expect(noteTypeDateKeys.apply(before, {today: TODAY})).toBe(before);
  });

  it('is idempotent: second run yields zero diff', () => {
    const before = '---\ntype: task\n---\nBody.\n';
    const once = apply(before, before);
    expect(apply(once, once)).toBe(once);
  });
});
