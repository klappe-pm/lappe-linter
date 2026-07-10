import {CoreRule, CoreRuleOptions} from '../rule';
import {computeIgnoreZones, IgnoreZone, isLineBlockMasked, LineSpan, lineSpans} from './ignore-zones';

/**
 * Normalize unordered list bullets: one marker style ("- " or "* ", default
 * "- ") and, by default, no blank lines between consecutive items (a tight
 * list). Ordered lists, thematic breaks (--- / ***), and anything inside
 * code, math, tables, or frontmatter are left untouched.
 */

const BULLET = /^(\s*)([-*+])(\s+)(\S.*)$/;
// A line of three or more markers (with optional spaces) is a thematic break.
const THEMATIC_BREAK = /^\s*([-*_])(\s*\1){2,}\s*$/;

function normalizeMarker(value: unknown): '-' | '*' {
  return value === '*' ? '*' : '-';
}

export const listStyle: CoreRule = {
  id: 'list-style',
  category: 'content',
  description: 'Normalize unordered list bullets to a single marker ("- " or "* ") and, by default, remove blank lines between items; ordered lists, thematic breaks, and masked blocks are untouched.',
  defaultOptions: {marker: '-', tighten: true},
  apply: (text, options: CoreRuleOptions) => {
    const marker = normalizeMarker(options['marker']);
    const tighten = options['tighten'] !== false;
    const zones = computeIgnoreZones(text);
    const lines = lineSpans(text);

    const isBullet = (index: number): boolean => {
      const line = lines[index];
      return !isLineBlockMasked(zones, line) && !THEMATIC_BREAK.test(line.text) && BULLET.test(line.text);
    };

    const rendered: Array<string | null> = lines.map((line, index) => {
      if (!isBullet(index)) {
        return line.text;
      }
      const m = BULLET.exec(line.text) as RegExpExecArray;
      return `${m[1]}${marker} ${m[4]}`;
    });

    if (tighten) {
      for (let i = 0; i < lines.length; i++) {
        if (rendered[i] !== null && lines[i].text.trim() === '' && !isLineBlockMasked(zones, lines[i])) {
          // Drop this blank line only if it sits strictly between two items.
          const prev = prevNonBlank(rendered, i);
          const next = nextNonBlank(rendered, lines, i);
          if (prev >= 0 && isBullet(prev) && next >= 0 && isBullet(next) && onlyBlanksBetween(lines, zones, prev, next)) {
            rendered[i] = null;
          }
        }
      }
    }

    // The trailing empty span (from a final newline) stays in `rendered`, so
    // join reproduces the original trailing newline without appending one.
    return rendered.filter((line): line is string => line !== null).join('\n');
  },
  examples: [
    {
      description: 'Asterisk bullets become dashes',
      before: '* one\n* two\n',
      after: '- one\n- two\n',
    },
    {
      description: 'Blank lines between items are removed',
      before: '- one\n\n- two\n\n- three\n',
      after: '- one\n- two\n- three\n',
    },
    {
      description: 'Dashes to stars, tightened',
      before: '- one\n\n- two\n',
      after: '* one\n* two\n',
      options: {marker: '*'},
    },
    {
      description: 'Thematic breaks and ordered lists are left alone',
      before: '1. one\n2. two\n\n---\n\ntext\n',
      after: '1. one\n2. two\n\n---\n\ntext\n',
    },
  ],
};

function prevNonBlank(rendered: Array<string | null>, from: number): number {
  for (let i = from - 1; i >= 0; i--) {
    if (rendered[i] !== null && rendered[i]!.trim() !== '') {
      return i;
    }
  }
  return -1;
}

function nextNonBlank(rendered: Array<string | null>, lines: LineSpan[], from: number): number {
  for (let i = from + 1; i < rendered.length; i++) {
    if (rendered[i] !== null && lines[i].text.trim() !== '') {
      return i;
    }
  }
  return -1;
}

// True when every line strictly between prev and next is blank (so we are
// closing a gap inside one list, not merging a list into following prose).
function onlyBlanksBetween(lines: LineSpan[], zones: IgnoreZone[], prev: number, next: number): boolean {
  for (let i = prev + 1; i < next; i++) {
    if (isLineBlockMasked(zones, lines[i]) || lines[i].text.trim() !== '') {
      return false;
    }
  }
  return true;
}
