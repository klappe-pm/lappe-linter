import {CoreRuleOptions} from '../../src/rule';
import {stripStrong} from '../../src/rules-content';

function apply(input: string, options: CoreRuleOptions = {}): string {
  const opts = {...(stripStrong.defaultOptions ?? {}), ...options};
  const once = stripStrong.apply(input, opts);
  expect(stripStrong.apply(once, opts)).toBe(once);
  return once;
}

describe('strip-strong', () => {
  it('strips asterisk and underscore strong emphasis', () => {
    expect(apply('a **b** c __d__ e\n')).toBe('a b c d e\n');
  });

  it('strips nested strong to a fixpoint', () => {
    expect(apply('**a __b__ c** and __x **y** z__\n')).toBe('a b c and x y z\n');
  });

  it('leaves single-marker emphasis alone', () => {
    expect(apply('*italic* and _also italic_\n')).toBe('*italic* and _also italic_\n');
  });

  it('leaves intra-word underscores alone', () => {
    expect(apply('snake__case__name stays\n')).toBe('snake__case__name stays\n');
  });

  it('leaves code fences containing bold markers untouched', () => {
    const input = '```\nconst x = "**bold**";\n__init__\n```\n**outside**\n';
    expect(apply(input)).toBe('```\nconst x = "**bold**";\n__init__\n```\noutside\n');
  });

  it('leaves frontmatter containing double asterisks untouched', () => {
    const input = '---\ntitle: "**keep me**"\nnote: __and me__\n---\n\n**strip me**\n';
    expect(apply(input)).toBe('---\ntitle: "**keep me**"\nnote: __and me__\n---\n\nstrip me\n');
  });

  it('leaves inline code, math, tables, wikilinks, and URLs untouched', () => {
    const input =
      'code `**x**` math $**y**$ table below\n\n| **a** | b |\n| ----- | - |\n\nlink [[**Note**]] url https://e.io/a__b__c\n';
    expect(apply(input)).toBe(
      'code `**x**` math $**y**$ table below\n\n| **a** | b |\n| ----- | - |\n\nlink [[**Note**]] url https://e.io/a__b__c\n',
    );
  });

  it('strips strong wrapped around inline code but not inside it', () => {
    expect(apply('a **`code` span** b\n')).toBe('a `code` span b\n');
  });

  it('keeps heading strong only when keep-heading-strong is true', () => {
    const input = '# A **bold** title\n\nbody **bold**\n';
    expect(apply(input)).toBe('# A bold title\n\nbody bold\n');
    expect(apply(input, {'keep-heading-strong': true})).toBe('# A **bold** title\n\nbody bold\n');
  });

  it('does not pair markers across blank lines', () => {
    const input = 'start ** dangling\n\nmore ** text\n';
    expect(apply(input)).toBe(input);
  });

  it('converts bold italic to italic', () => {
    expect(apply('***both***\n')).toBe('*both*\n');
  });
});
