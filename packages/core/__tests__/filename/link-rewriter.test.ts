import {rewriteLinks} from '../../src/filename';

const renames = new Map([
  ['Old Note', 'old-note'],
  ['Other', 'other-thing'],
]);

describe('rewriteLinks', () => {
  const cases: Array<[string, string, string]> = [
    ['plain wikilink', 'see [[Old Note]] here', 'see [[old-note]] here'],
    ['aliased wikilink', '[[Old Note|the alias]]', '[[old-note|the alias]]'],
    ['heading anchor', '[[Old Note#Some Section]]', '[[old-note#Some Section]]'],
    ['anchor plus alias', '[[Old Note#Sec|alias]]', '[[old-note#Sec|alias]]'],
    ['embed', '![[Old Note]]', '![[old-note]]'],
    ['folder-qualified wikilink', '[[dir/Old Note]]', '[[dir/old-note]]'],
    ['wikilink with extension', '[[Old Note.md]]', '[[old-note.md]]'],
    ['markdown link', '[text](Other.md)', '[text](other-thing.md)'],
    ['markdown link with anchor', '[t](Other.md#sec)', '[t](other-thing.md#sec)'],
    ['percent-encoded markdown link', '[text](Old%20Note.md)', '[text](old-note.md)'],
    ['unmapped stem untouched', '[[Different Note]]', '[[Different Note]]'],
    ['non-md markdown link untouched', '[img](Other.png)', '[img](Other.png)'],
    ['absolute url untouched', '[x](https://example.com/Other.md)', '[x](https://example.com/Other.md)'],
    ['same-file anchor untouched', '[[#Heading]]', '[[#Heading]]'],
    ['inline code untouched', 'code `[[Old Note]]` and [[Old Note]]', 'code `[[Old Note]]` and [[old-note]]'],
  ];

  it.each(cases)('%s', (_name, input, expected) => {
    expect(rewriteLinks(input, renames)).toBe(expected);
  });

  it('never touches links inside code fences', () => {
    const text = 'before [[Old Note]]\n```md\n[[Old Note]]\n[link](Other.md)\n```\nafter [[Old Note]]\n';
    const expected = 'before [[old-note]]\n```md\n[[Old Note]]\n[link](Other.md)\n```\nafter [[old-note]]\n';
    expect(rewriteLinks(text, renames)).toBe(expected);
  });

  it('handles tilde fences and nested backtick-fence content', () => {
    const text = '~~~\n[[Old Note]]\n~~~\n[[Old Note]]\n';
    expect(rewriteLinks(text, renames)).toBe('~~~\n[[Old Note]]\n~~~\n[[old-note]]\n');
  });

  it('returns text unchanged for an empty rename map', () => {
    const text = '[[Old Note]]\n';
    expect(rewriteLinks(text, new Map())).toBe(text);
  });

  it('is idempotent once targets are renamed', () => {
    const once = rewriteLinks('[[Old Note]] and [x](Other.md)\n', renames);
    expect(rewriteLinks(once, renames)).toBe(once);
  });
});
