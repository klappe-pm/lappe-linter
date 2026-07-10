/**
 * Clean-room masking for content rules. Computes the regions of a document
 * that content rules must never edit: YAML frontmatter, fenced and indented
 * code, inline code, math (block and inline), tables, wikilinks and embeds,
 * and URLs. Each rule computes zones once per application over its input and
 * transforms only text that falls outside every zone. The upstream plugin's
 * IgnoreTypes machinery is not importable from core; this is the minimal
 * equivalent, and it errs on the side of masking too much rather than too
 * little.
 */

export type IgnoreZoneKind =
  | 'frontmatter'
  | 'code-fence'
  | 'indented-code'
  | 'inline-code'
  | 'math-block'
  | 'inline-math'
  | 'table'
  | 'wikilink'
  | 'url';

export interface IgnoreZone {
  /** Inclusive start offset into the document. */
  start: number;
  /** Exclusive end offset into the document. */
  end: number;
  kind: IgnoreZoneKind;
}

export interface LineSpan {
  /** Offset of the first character of the line. */
  start: number;
  /** Exclusive end offset of the line content, before the newline. */
  end: number;
  text: string;
}

/** Zone kinds that always cover whole lines; line-based rules skip these lines entirely. */
const BLOCK_KINDS: ReadonlySet<IgnoreZoneKind> = new Set([
  'frontmatter',
  'code-fence',
  'indented-code',
  'math-block',
  'table',
]);

export function lineSpans(text: string): LineSpan[] {
  const spans: LineSpan[] = [];
  let start = 0;
  for (;;) {
    const nl = text.indexOf('\n', start);
    if (nl === -1) {
      spans.push({start, end: text.length, text: text.slice(start)});
      return spans;
    }
    spans.push({start, end: nl, text: text.slice(start, nl)});
    start = nl + 1;
  }
}

/** Fence delimiter: up to three spaces of indent then a backtick or tilde run. Shared with filename/masking.ts. */
export const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const TABLE_DELIM_ROW = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

function blockZones(lines: LineSpan[]): IgnoreZone[] {
  const zones: IgnoreZone[] = [];
  const lastEnd = lines.length > 0 ? lines[lines.length - 1].end : 0;
  let i = 0;

  if (lines.length > 1 && lines[0].text.trimEnd() === '---') {
    for (let j = 1; j < lines.length; j++) {
      const t = lines[j].text.trimEnd();
      if (t === '---' || t === '...') {
        zones.push({start: 0, end: lines[j].end, kind: 'frontmatter'});
        i = j + 1;
        break;
      }
    }
  }

  let prevBlank = true;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.text;
    const trimmed = t.trim();

    const fence = FENCE_OPEN.exec(t);
    if (fence) {
      const marker = fence[1][0];
      const closeRe = new RegExp(`^ {0,3}${marker}{${fence[1].length},}[ \t]*$`);
      let j = i + 1;
      while (j < lines.length && !closeRe.test(lines[j].text)) j++;
      zones.push({start: line.start, end: j < lines.length ? lines[j].end : lastEnd, kind: 'code-fence'});
      i = j + 1;
      prevBlank = false;
      continue;
    }

    if (trimmed.startsWith('$$')) {
      const closeInLine = trimmed.length > 2 ? trimmed.indexOf('$$', 2) : -1;
      if (closeInLine === -1) {
        let j = i + 1;
        while (j < lines.length && !lines[j].text.trim().endsWith('$$')) j++;
        zones.push({start: line.start, end: j < lines.length ? lines[j].end : lastEnd, kind: 'math-block'});
        i = j + 1;
        prevBlank = false;
        continue;
      }
      if (closeInLine === trimmed.length - 2) {
        zones.push({start: line.start, end: line.end, kind: 'math-block'});
        i++;
        prevBlank = false;
        continue;
      }
      // Math closes mid-line with trailing prose; the inline pass masks it.
    }

    const delimNext =
      i + 1 < lines.length &&
      lines[i + 1].text.includes('|') &&
      TABLE_DELIM_ROW.test(lines[i + 1].text);
    if (/^ {0,3}\|/.test(t) || (trimmed !== '' && t.includes('|') && delimNext)) {
      let j = i;
      while (j < lines.length && lines[j].text.includes('|') && lines[j].text.trim() !== '') j++;
      zones.push({start: line.start, end: lines[j - 1].end, kind: 'table'});
      i = j;
      prevBlank = false;
      continue;
    }

    if (prevBlank && trimmed !== '' && /^( {4}|\t)/.test(t)) {
      let j = i;
      while (j < lines.length && (lines[j].text.trim() === '' || /^( {4}|\t)/.test(lines[j].text))) j++;
      while (j > i && lines[j - 1].text.trim() === '') j--;
      zones.push({start: line.start, end: lines[j - 1].end, kind: 'indented-code'});
      i = j;
      prevBlank = false;
      continue;
    }

    prevBlank = trimmed === '';
    i++;
  }
  return zones;
}

/**
 * CommonMark-style code spans: a run of N backticks closes only on the next
 * run of exactly N backticks. Returns [start, end) offsets within the line.
 * Exported so filename/masking.ts shares one inline-code definition.
 */
export function inlineCodeSpans(t: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let i = 0;
  while (i < t.length) {
    if (t[i] !== '`') {
      i++;
      continue;
    }
    let n = 1;
    while (t[i + n] === '`') n++;
    let j = i + n;
    let closed = false;
    while (j < t.length) {
      if (t[j] !== '`') {
        j++;
        continue;
      }
      let m = 1;
      while (t[j + m] === '`') m++;
      if (m === n) {
        spans.push([i, j + m]);
        i = j + m;
        closed = true;
        break;
      }
      j += m;
    }
    if (!closed) i += n;
  }
  return spans;
}

const INLINE_PATTERNS: ReadonlyArray<{kind: IgnoreZoneKind; re: RegExp}> = [
  {kind: 'inline-math', re: /\$\$.+?\$\$/g},
  {kind: 'inline-math', re: /\$(?![\s$])(?:[^$\n]*?[^\s$\\])?\$(?!\d)/g},
  {kind: 'wikilink', re: /!?\[\[[^\]\n]*\]\]/g},
  {kind: 'url', re: /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s<>]+/g},
  {kind: 'url', re: /\]\([^)\n]*\)/g},
];

function inlineZones(lines: LineSpan[], blocks: IgnoreZone[]): IgnoreZone[] {
  const zones: IgnoreZone[] = [];
  for (const line of lines) {
    if (line.text === '') continue;
    if (blocks.some((z) => z.start <= line.start && z.end >= line.end)) continue;
    const local: IgnoreZone[] = [];
    for (const [s, e] of inlineCodeSpans(line.text)) {
      const zone: IgnoreZone = {start: line.start + s, end: line.start + e, kind: 'inline-code'};
      local.push(zone);
      zones.push(zone);
    }
    for (const {kind, re} of INLINE_PATTERNS) {
      const rx = new RegExp(re.source, re.flags);
      let m: RegExpExecArray | null;
      while ((m = rx.exec(line.text)) !== null) {
        if (m[0].length === 0) {
          rx.lastIndex++;
          continue;
        }
        const start = line.start + m.index;
        const end = start + m[0].length;
        if (local.some((z) => z.start < end && z.end > start)) {
          rx.lastIndex = m.index + 1;
          continue;
        }
        const zone: IgnoreZone = {start, end, kind};
        local.push(zone);
        zones.push(zone);
      }
    }
  }
  return zones;
}

export function computeIgnoreZones(text: string): IgnoreZone[] {
  const lines = lineSpans(text);
  const blocks = blockZones(lines);
  return [...blocks, ...inlineZones(lines, blocks)].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
}

/** True when [start, end) overlaps any zone. */
export function inZone(zones: IgnoreZone[], start: number, end: number = start + 1): boolean {
  return zones.some((z) => z.start < end && z.end > start);
}

/** True when the line lies inside a whole-line (block) zone. */
export function isLineBlockMasked(zones: IgnoreZone[], line: LineSpan): boolean {
  return zones.some(
    (z) => BLOCK_KINDS.has(z.kind) && z.start <= line.start && z.end >= line.end,
  );
}

/**
 * Run a global regex over the text and rewrite each match through `replace`,
 * skipping any match that overlaps a zone. Returning the matched text from
 * `replace` leaves that occurrence unchanged.
 */
export function replaceOutsideZones(
  text: string,
  pattern: RegExp,
  replace: (match: RegExpExecArray) => string,
  zones: IgnoreZone[] = computeIgnoreZones(text),
): string {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const re = new RegExp(pattern.source, flags);
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    const end = m.index + m[0].length;
    if (inZone(zones, m.index, end)) {
      re.lastIndex = m.index + 1;
      continue;
    }
    out += text.slice(last, m.index) + replace(m);
    last = end;
  }
  return out + text.slice(last);
}
