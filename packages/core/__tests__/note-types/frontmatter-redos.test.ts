import {performance} from 'perf_hooks';
import {splitEntries} from '../../src/note-types/frontmatter';
import {noteTypeDateKeys, starterNoteTypes} from '../../src/note-types';

/**
 * SEC-001 regression: the KEY_LINE matcher used to backtrack quadratically on
 * a frontmatter line with a long colon-free whitespace run ('a' + 160k spaces
 * measured 14.3s), freezing every surface (plugin save, CLI, hooks) from
 * untrusted note content. The matcher must stay linear.
 */
describe('splitEntries ReDoS resistance (SEC-001)', () => {
  const TIME_BUDGET_MS = 250;

  it('handles a colon-free line with a huge whitespace run within the time budget', () => {
    const hostile = 'X' + ' '.repeat(400_000);
    const start = performance.now();
    const entries = splitEntries([hostile]);
    expect(performance.now() - start).toBeLessThan(TIME_BUDGET_MS);
    expect(entries).toEqual([{key: null, lines: [hostile]}]);
  });

  it('handles interleaved words and whitespace with a trailing colon within the time budget', () => {
    const hostile = 'a' + ' '.repeat(200_000) + 'b' + ' '.repeat(200_000) + ':x';
    const start = performance.now();
    splitEntries([hostile]);
    expect(performance.now() - start).toBeLessThan(TIME_BUDGET_MS);
  });

  it('stays fast end to end through note-type-date-keys on a hostile note', () => {
    const hostile = `---\nX${' '.repeat(400_000)}\n---\nbody\n`;
    const start = performance.now();
    const out = noteTypeDateKeys.apply(hostile, {
      schema: starterNoteTypes['task'],
      today: '2026-07-10',
      originalText: hostile,
    });
    expect(performance.now() - start).toBeLessThan(TIME_BUDGET_MS * 2);
    expect(typeof out).toBe('string');
  });

  it('keeps key-line semantics after the linear rewrite', () => {
    const entries = splitEntries([
      'plain: value',
      'spaced key : value',
      '"quoted: key": value',
      '\'single: key\': value',
      'trailer  :',
      '  indented: not a top-level key',
      '- list item',
      '# comment',
      'no-colon-here',
    ]);
    expect(entries.map((entry) => entry.key)).toEqual([
      'plain',
      'spaced key',
      'quoted: key',
      'single: key',
      'trailer',
    ]);
    // Loose lines attach to the preceding entry, preserving byte identity.
    expect(entries[4].lines).toEqual([
      'trailer  :',
      '  indented: not a top-level key',
      '- list item',
      '# comment',
      'no-colon-here',
    ]);
  });
});
