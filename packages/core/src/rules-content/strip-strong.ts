import {CoreRule, CoreRuleOptions} from '../rule';
import {computeIgnoreZones, inZone, lineSpans} from './ignore-zones';

const STRONG = /(\*\*|__)(?!\s)([\s\S]*?\S)\1/g;
const HEADING_LINE = /^ {0,3}#{1,6}(\s|$)/;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9_]/.test(ch);
}

function stripOnce(text: string, keepHeadingStrong: boolean): string {
  const zones = computeIgnoreZones(text);
  const headingLines = keepHeadingStrong ?
    lineSpans(text).filter((l) => HEADING_LINE.test(l.text)) :
    [];
  const onHeadingLine = (index: number): boolean =>
    headingLines.some((l) => l.start <= index && index <= l.end);

  const re = new RegExp(STRONG.source, STRONG.flags);
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const delim = m[1];
    const content = m[2];
    const skip =
      inZone(zones, start, start + delim.length) ||
      inZone(zones, end - delim.length, end) ||
      /\n[ \t]*\n/.test(content) ||
      (delim === '__' && (isWordChar(text[start - 1]) || isWordChar(text[end]))) ||
      (keepHeadingStrong && onHeadingLine(start));
    if (skip) {
      re.lastIndex = start + 1;
      continue;
    }
    out += text.slice(last, start) + content;
    last = end;
  }
  return out + text.slice(last);
}

/**
 * defaultOptions:
 * - `keep-heading-strong` (boolean, default false): when true, strong
 *   emphasis inside ATX headings is preserved.
 */
export const stripStrong: CoreRule = {
  id: 'strip-strong',
  category: 'content',
  description:
    'Remove ** and __ strong emphasis, keeping the inner text; never edits inside code, math, YAML, tables, wikilinks, or URLs.',
  defaultOptions: {'keep-heading-strong': false},
  apply: (text, options: CoreRuleOptions) => {
    const keepHeadingStrong = options['keep-heading-strong'] === true;
    let cur = text;
    for (;;) {
      const next = stripOnce(cur, keepHeadingStrong);
      if (next === cur) return cur;
      cur = next;
    }
  },
  examples: [
    {
      description: 'Asterisk and underscore strong emphasis are unwrapped',
      before: 'This is **very** important and __also__ this.\n',
      after: 'This is very important and also this.\n',
    },
    {
      description: 'Bold italic keeps its italic marker',
      before: 'a ***key*** point\n',
      after: 'a *key* point\n',
    },
    {
      description: 'Nested strong of the other flavor is stripped too',
      before: '**outer __inner__ text**\n',
      after: 'outer inner text\n',
    },
    {
      description: 'Code, math, and frontmatter are untouched',
      before: '---\ntitle: "**keep**"\n---\n\nuse `**not bold**` and $a**b$\n\n**real bold**\n',
      after: '---\ntitle: "**keep**"\n---\n\nuse `**not bold**` and $a**b$\n\nreal bold\n',
    },
    {
      description: 'keep-heading-strong preserves strong inside headings',
      before: '## A **bold** heading\n\nbody **bold** text\n',
      after: '## A **bold** heading\n\nbody bold text\n',
      options: {'keep-heading-strong': true},
    },
  ],
};
