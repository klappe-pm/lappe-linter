import {_resetRegistryForTests, getRule} from '../../src/rule';
import {runRules} from '../../src/runner';
import {
  proseListToSentences,
  proseListToSentencesFix,
  registerContentRules,
} from '../../src/rules-content';

function applyFix(input: string): string {
  const once = proseListToSentencesFix.apply(input, {});
  expect(proseListToSentencesFix.apply(once, {})).toBe(once);
  return once;
}

describe('prose-list-to-sentences (report) and -fix (transform)', () => {
  beforeEach(() => {
    _resetRegistryForTests();
    registerContentRules();
  });

  it('is registered report-only; the fix twin is not', () => {
    expect(getRule('prose-list-to-sentences')?.reportOnly).toBe(true);
    expect(getRule('prose-list-to-sentences-fix')?.reportOnly).toBeUndefined();
  });

  it('report rule surfaces a violation without changing the text', () => {
    const doc = 'Bring:\n- rope\n- water\n';
    const result = runRules(doc, {rules: {'prose-list-to-sentences': {enabled: true}}});
    expect(result.text).toBe(doc);
    expect(result.changed).toBe(false);
    expect(result.violations).toEqual([
      {rule: 'prose-list-to-sentences', message: proseListToSentences.description, fixed: false},
    ]);
  });

  it('report rule stays silent on documents with nothing to convert', () => {
    const doc = '- [ ] task\n- [x] done\n';
    const result = runRules(doc, {rules: {'prose-list-to-sentences': {enabled: true}}});
    expect(result.violations).toEqual([]);
  });

  it('fix rule converts only when enabled', () => {
    const doc = 'Bring:\n- rope\n- water\n- a map\n';
    const off = runRules(doc, {rules: {}});
    expect(off.text).toBe(doc);
    const on = runRules(doc, {rules: {'prose-list-to-sentences-fix': {enabled: true}}});
    expect(on.text).toBe('Bring: rope, water, and a map.\n');
  });

  it('joins two items with and, three or more with commas and a final and', () => {
    expect(applyFix('- one\n- two\n')).toBe('one and two.\n');
    expect(applyFix('- one\n- two\n- three\n')).toBe('one, two, and three.\n');
  });

  it('strips trailing item punctuation before joining', () => {
    expect(applyFix('- first,\n- second;\n- third.\n')).toBe('first, second, and third.\n');
  });

  it('never touches nested lists, even the flat items around the nest', () => {
    const doc = '- outer one\n  - nested\n- outer two\n- outer three\n';
    expect(applyFix(doc)).toBe(doc);
  });

  it('never touches task lists or ordered lists', () => {
    const tasks = '- [ ] buy rope\n- [x] buy water\n';
    expect(applyFix(tasks)).toBe(tasks);
    const ordered = '1. first\n2. second\n';
    expect(applyFix(ordered)).toBe(ordered);
  });

  it('never touches lists with multi-line items', () => {
    const lazy = '- item one\n- item two\nwrapped tail of item two\n';
    expect(applyFix(lazy)).toBe(lazy);
    const indented = '- item one\n- item two\n  indented continuation\n';
    expect(applyFix(indented)).toBe(indented);
  });

  it('never touches single-item lists or lists adjacent to other lists', () => {
    expect(applyFix('- lonely\n')).toBe('- lonely\n');
    const afterOrdered = '1. intro\n- a\n- b\n';
    expect(applyFix(afterOrdered)).toBe(afterOrdered);
  });

  it('never touches mixed-marker runs', () => {
    const mixed = '- a\n* b\n';
    expect(applyFix(mixed)).toBe(mixed);
  });

  it('never touches list-lookalikes inside code fences or frontmatter', () => {
    const doc = '---\ntags:\n- one\n- two\n---\n\n```\n- a\n- b\n```\n';
    expect(applyFix(doc)).toBe(doc);
  });

  it('converts independent simple lists separately', () => {
    const doc = '- a\n- b\n\nBetween paragraphs.\n\n- c\n- d\n';
    expect(applyFix(doc)).toBe('a and b.\n\nBetween paragraphs.\n\nc and d.\n');
  });

  it('skips items whose text would re-parse as a list marker', () => {
    const doc = '- - tricky\n- plain\n';
    expect(applyFix(doc)).toBe(doc);
  });
});
