import {CoreRuleOptions} from '../../src/rule';
import {joinParagraphLines} from '../../src/rules-content';

function apply(input: string, options: CoreRuleOptions = {}): string {
  const opts = {...(joinParagraphLines.defaultOptions ?? {}), ...options};
  const once = joinParagraphLines.apply(input, opts);
  expect(joinParagraphLines.apply(once, opts)).toBe(once);
  return once;
}

describe('join-paragraph-lines', () => {
  it('joins a wrapped paragraph adjacent to a nested list without touching the list', () => {
    const input =
      'A paragraph that was\nwrapped by hand.\n- item one\n  - nested item\n- item two\n';
    expect(apply(input)).toBe(
        'A paragraph that was wrapped by hand.\n- item one\n  - nested item\n- item two\n',
    );
  });

  it('never joins list items or their indented continuations', () => {
    const input = '- item one\n  continuation of one\n- item two\n';
    expect(apply(input)).toBe(input);
  });

  it('never joins blockquote lines or lazy continuations after them', () => {
    const input = '> quoted line one\n> quoted line two\nlazy continuation\n';
    expect(apply(input)).toBe(input);
  });

  it('leaves table rows alone even when cells look hard-wrapped', () => {
    const input =
      'intro line\nstill intro\n\n| col a | col b |\n| ----- | ----- |\n| text that was | wrapped |\n| by hand | here |\n';
    expect(apply(input)).toBe(
        'intro line still intro\n\n| col a | col b |\n| ----- | ----- |\n| text that was | wrapped |\n| by hand | here |\n',
    );
  });

  it('leaves fenced code, math blocks, and frontmatter untouched', () => {
    const input =
      '---\ntitle: x\ndesc: y\n---\n\n```\ncode line one\ncode line two\n```\n\n$$\nx = 1\ny = 2\n$$\n';
    expect(apply(input)).toBe(input);
  });

  it('does not merge a setext heading into the paragraph above it', () => {
    const input = 'some paragraph\nHeading Text\n===\nbody follows\nwrapped body\n';
    expect(apply(input)).toBe('some paragraph\nHeading Text\n===\nbody follows wrapped body\n');
  });

  it('preserves intentional breaks: two spaces, <br>, <br/>, and backslash', () => {
    const input =
      'two spaces  \nnext\n\nbreak tag<br>\nnext two\n\ntag close<br/>\nnext three\n\nbackslash\\\nnext four\n';
    expect(apply(input)).toBe(input);
  });

  it('trims a single trailing space when joining', () => {
    expect(apply('one trailing space \nnext line\n')).toBe('one trailing space next line\n');
  });

  it('does not join headings, hr lines, wikilink-only lines, or footnote definitions', () => {
    const input =
      '# Heading\nprose after heading\n\n![[embed.png]]\nprose after embed\n\n[^1]: a footnote\ndefinition tail\n';
    expect(apply(input)).toBe(input);
  });

  it('handles a document with no trailing newline', () => {
    expect(apply('alpha\nbeta')).toBe('alpha beta');
  });
});
