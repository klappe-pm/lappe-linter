import {CoreRuleOptions} from '../../src/rule';
import {EM_DASH, EN_DASH, replaceEmDash} from '../../src/rules-content';

function apply(input: string, options: CoreRuleOptions = {}): string {
  const opts = {...(replaceEmDash.defaultOptions ?? {}), ...options};
  const once = replaceEmDash.apply(input, opts);
  expect(replaceEmDash.apply(once, opts)).toBe(once);
  return once;
}

describe('replace-em-dash', () => {
  it('replaces em dashes and normalizes surrounding whitespace', () => {
    expect(apply(`a ${EM_DASH} b\n`)).toBe('a, b\n');
    expect(apply(`a${EM_DASH}b\n`)).toBe('a, b\n');
    expect(apply(`a  ${EM_DASH}  b\n`)).toBe('a, b\n');
  });

  it('replaces connector en dashes', () => {
    expect(apply(`setup ${EN_DASH} teardown\n`)).toBe('setup, teardown\n');
  });

  it('keeps numeric en dash ranges, spaced or tight', () => {
    expect(apply(`pages 3${EN_DASH}9\n`)).toBe(`pages 3${EN_DASH}9\n`);
    expect(apply(`years 2024 ${EN_DASH} 2026\n`)).toBe(`years 2024 ${EN_DASH} 2026\n`);
  });

  it('replaces an em dash between digits (only en dash ranges are exempt)', () => {
    expect(apply(`1${EM_DASH}5\n`)).toBe('1, 5\n');
  });

  it('collapses a run of dashes into one replacement', () => {
    expect(apply(`a ${EM_DASH}${EM_DASH} b\n`)).toBe('a, b\n');
  });

  it('maps word-joining dashes to a hyphen only when the option is on', () => {
    expect(apply(`rock${EN_DASH}solid\n`)).toBe('rock, solid\n');
    expect(apply(`rock${EN_DASH}solid\n`, {'word-joining': true})).toBe('rock-solid\n');
    expect(apply(`well${EM_DASH}known\n`, {'word-joining': true})).toBe('well-known\n');
  });

  it('trims the replacement at end of line and end of document', () => {
    expect(apply(`hangs ${EM_DASH}\nnext\n`)).toBe('hangs,\nnext\n');
    expect(apply(`hangs ${EM_DASH}`)).toBe('hangs,');
  });

  it('leaves line-leading dashes alone', () => {
    const input = `${EM_DASH} dialogue opener\n`;
    expect(apply(input)).toBe(input);
  });

  it('never edits inside inline code', () => {
    const input = `run \`git log ${EM_DASH}${EM_DASH}oneline\` then stop ${EM_DASH} done\n`;
    expect(apply(input)).toBe(`run \`git log ${EM_DASH}${EM_DASH}oneline\` then stop, done\n`);
  });

  it('never edits inside URLs', () => {
    const input = `see https://e.io/a${EM_DASH}b?q=x${EN_DASH}y ${EM_DASH} noted\n`;
    expect(apply(input)).toBe(`see https://e.io/a${EM_DASH}b?q=x${EN_DASH}y, noted\n`);
  });

  it('never edits inside code fences, math, YAML, tables, or wikilinks', () => {
    const input = [
      '---',
      `summary: alpha ${EM_DASH} beta`,
      '---',
      '',
      '```',
      `flag ${EM_DASH}${EM_DASH}verbose`,
      '```',
      '',
      `$$`,
      `a ${EM_DASH} b`,
      `$$`,
      '',
      `| x ${EM_DASH} y | z |`,
      '| --- | --- |',
      '',
      `[[Page ${EM_DASH} Section]] stays ${EM_DASH} prose changes`,
      '',
    ].join('\n');
    const expected = input.replace(`stays ${EM_DASH} prose`, 'stays, prose');
    expect(apply(input)).toBe(expected);
  });

  it('supports a custom replacement string', () => {
    expect(apply(`cause ${EM_DASH} effect\n`, {replacement: ' ; '})).toBe('cause ; effect\n');
  });
});
