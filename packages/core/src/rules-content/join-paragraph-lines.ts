import {CoreRule} from '../rule';
import {computeIgnoreZones, isLineBlockMasked, lineSpans} from './ignore-zones';

/**
 * A line ending in two or more spaces, a `<br>` tag, or a trailing backslash
 * is an intentional hard break and is never joined with the next line.
 */
export const INTENTIONAL_BREAK = /( {2,}|<br[ \t]*\/?>[ \t]*|\\)$/i;

/** A setext underline turns the line above it into a heading; never join around one. */
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;

export function isJoinableProse(line: string): boolean {
  if (line.trim() === '') return false;
  if (/^\s/.test(line)) return false;
  if (/^#{1,6}\s/.test(line)) return false;
  if (/^>/.test(line)) return false;
  if (/^([-*+]|\d{1,9}[.)])(\s|$)/.test(line)) return false;
  if (/^\|/.test(line)) return false;
  if (SETEXT_UNDERLINE.test(line)) return false;
  if (/^(\*[ \t]*){3,}$/.test(line) || /^(_[ \t]*){3,}$/.test(line)) return false;
  if (/^(`{3,}|~{3,})/.test(line)) return false;
  if (/^\$\$/.test(line)) return false;
  if (/^\[[^\]]*\]:/.test(line)) return false;
  if (/^!?\[\[[^\]]+\]\][ \t]*$/.test(line)) return false;
  if (/^</.test(line)) return false;
  return true;
}

/**
 * defaultOptions: none. The rule takes no options.
 *
 * Input is expected LF-normalized; CRLF documents should be normalized before
 * this rule runs.
 */
export const joinParagraphLines: CoreRule = {
  id: 'join-paragraph-lines',
  category: 'content',
  description:
    'Unwrap hard-wrapped prose lines inside a paragraph into a single line, leaving lists, blockquotes, tables, headings, code, math, YAML, and intentional breaks untouched.',
  apply: (text) => {
    const zones = computeIgnoreZones(text);
    const lines = lineSpans(text);
    const out: string[] = [];
    let cur: string | null = null;
    let curCanExtend = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextIsSetext = i + 1 < lines.length && SETEXT_UNDERLINE.test(lines[i + 1].text);
      const joinable =
        !isLineBlockMasked(zones, line) && isJoinableProse(line.text) && !nextIsSetext;
      if (cur !== null && curCanExtend && joinable) {
        cur = cur.replace(/[ \t]+$/, '') + ' ' + line.text;
        curCanExtend = !INTENTIONAL_BREAK.test(line.text);
      } else {
        if (cur !== null) out.push(cur);
        cur = line.text;
        curCanExtend = joinable && !INTENTIONAL_BREAK.test(line.text);
      }
    }
    if (cur !== null) out.push(cur);
    return out.join('\n');
  },
  examples: [
    {
      description: 'Hard-wrapped paragraph becomes one line',
      before: 'This paragraph was wrapped\nat a fixed column by an\nold editor.\n',
      after: 'This paragraph was wrapped at a fixed column by an old editor.\n',
    },
    {
      description: 'Two trailing spaces mark an intentional break and are preserved',
      before: 'line one ends here  \nline two stays separate\nbut joins line three\n',
      after: 'line one ends here  \nline two stays separate but joins line three\n',
    },
    {
      description: 'A <br> tag marks an intentional break',
      before: 'first line<br>\nsecond line\n',
      after: 'first line<br>\nsecond line\n',
    },
    {
      description: 'Lists, headings, and blockquotes are never joined',
      before: '# Title\n\n- item one\n- item two\n\n> quoted\n> lines\n',
      after: '# Title\n\n- item one\n- item two\n\n> quoted\n> lines\n',
    },
    {
      description: 'Paragraphs separated by blank lines stay separate',
      before: 'first paragraph\nstill first\n\nsecond paragraph\nstill second\n',
      after: 'first paragraph still first\n\nsecond paragraph still second\n',
    },
  ],
};
