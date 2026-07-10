import {listStyle} from '../../src/rules-content/list-style';

const run = (text: string, options: Record<string, unknown> = {}) =>
  listStyle.apply(text, {...listStyle.defaultOptions, ...options});

describe('list-style', () => {
  it('normalizes mixed markers to dashes by default', () => {
    expect(run('* one\n+ two\n- three\n')).toBe('- one\n- two\n- three\n');
  });

  it('switches to stars when configured', () => {
    expect(run('- one\n- two\n', {marker: '*'})).toBe('* one\n* two\n');
  });

  it('removes blank lines between items when tightening', () => {
    expect(run('- one\n\n- two\n\n- three\n')).toBe('- one\n- two\n- three\n');
  });

  it('keeps blank lines between items when tighten is off', () => {
    expect(run('- one\n\n- two\n', {tighten: false})).toBe('- one\n\n- two\n');
  });

  it('preserves indentation on nested bullets', () => {
    expect(run('* a\n  * b\n')).toBe('- a\n  - b\n');
  });

  it('leaves thematic breaks alone', () => {
    expect(run('---\n\ntext\n')).toBe('---\n\ntext\n');
    expect(run('***\n')).toBe('***\n');
  });

  it('does not touch bullet-like lines inside a code fence', () => {
    expect(run('```\n* not a list\n```\n\n* real\n')).toBe('```\n* not a list\n```\n\n- real\n');
  });

  it('does not merge a list into following prose', () => {
    expect(run('- one\n\nparagraph\n')).toBe('- one\n\nparagraph\n');
  });

  it('is idempotent', () => {
    const once = run('* one\n\n* two\n\n* three\n');
    expect(run(once)).toBe(once);
  });
});
