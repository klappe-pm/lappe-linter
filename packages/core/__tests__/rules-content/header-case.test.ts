import {formatHeadingText, headerCase, HeaderCaseStyle} from '../../src/rules-content/header-case';

describe('formatHeadingText', () => {
  const cases: Array<[HeaderCaseStyle, string, string]> = [
    ['camelCase', 'my great note', 'myGreatNote'],
    ['camelCase', 'My Great Note', 'myGreatNote'],
    ['First letter', 'the QUICK brown fox', 'The quick brown fox'],
    ['kebab-case', 'My Great Note', 'my-great-note'],
    ['kebab-case', 'already-kebab-case', 'already-kebab-case'],
    ['Title Case', 'the quick brown fox', 'The Quick Brown Fox'],
    ['underscore_formatted', 'My Great Note', 'my_great_note'],
  ];

  for (const [style, input, expected] of cases) {
    it(`${style}: "${input}" -> "${expected}"`, () => {
      expect(formatHeadingText(input, style)).toBe(expected);
    });
    it(`${style}: idempotent for "${input}"`, () => {
      const once = formatHeadingText(input, style);
      expect(formatHeadingText(once, style)).toBe(once);
    });
  }

  it('splits camelCase and mixed separators into words', () => {
    expect(formatHeadingText('myGreat_note-here', 'kebab-case')).toBe('my-great-note-here');
  });

  it('returns trimmed text for an empty word list', () => {
    expect(formatHeadingText('   ', 'kebab-case')).toBe('');
  });
});

describe('headerCase rule', () => {
  it('leaves all headings untouched when no level is configured', () => {
    const text = '# Some Title\n\n## Another\n';
    expect(headerCase.apply(text, {})).toBe(text);
  });

  it('only rewrites the configured levels', () => {
    const text = '# My Title\n\n## My Section\n\n### My Sub\n';
    const result = headerCase.apply(text, {h1: 'kebab-case', h3: 'Title Case'});
    expect(result).toBe('# my-title\n\n## My Section\n\n### My Sub\n');
  });

  it('preserves leading indentation and hash markers', () => {
    expect(headerCase.apply('   ## the section\n', {h2: 'Title Case'})).toBe('   ## The Section\n');
  });

  it('does not touch a heading-like line inside a code fence', () => {
    const text = '```md\n# Not A Heading\n```\n\n# Real One\n';
    expect(headerCase.apply(text, {h1: 'kebab-case'})).toBe('```md\n# Not A Heading\n```\n\n# real-one\n');
  });

  it('is a no-op on an empty heading', () => {
    expect(headerCase.apply('#\n', {h1: 'kebab-case'})).toBe('#\n');
  });
});
