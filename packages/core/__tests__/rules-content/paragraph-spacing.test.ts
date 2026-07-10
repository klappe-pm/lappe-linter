import {paragraphSpacing} from '../../src/rules-content/paragraph-spacing';

const run = (text: string, blank?: number) =>
  paragraphSpacing.apply(text, blank === undefined ? {} : {'blank-lines': blank});

describe('paragraph-spacing', () => {
  it('defaults to one blank line', () => {
    expect(run('a\n\n\n\nb\n')).toBe('a\n\nb\n');
  });

  it('trims leading and trailing blank lines', () => {
    expect(run('\n\na\n\nb\n\n\n')).toBe('a\n\nb\n');
  });

  it('clamps out-of-range counts to 0..2', () => {
    expect(run('a\n\nb\n', 5)).toBe('a\n\n\nb\n');
    expect(run('a\n\nb\n', -3)).toBe('a\nb\n');
  });

  it('preserves blank lines inside a code fence', () => {
    expect(run('```\nx\n\n\ny\n```\n\n\nz\n')).toBe('```\nx\n\n\ny\n```\n\nz\n');
  });

  it('is idempotent', () => {
    const once = run('a\n\n\nb\n\n\nc\n');
    expect(run(once)).toBe(once);
  });

  it('does not insert blanks between adjacent content lines', () => {
    expect(run('a\nb\n', 2)).toBe('a\nb\n');
  });
});
