import {CoreRule} from '../rule';
import {computeIgnoreZones, isLineBlockMasked, lineSpans} from './ignore-zones';
import {INTENTIONAL_BREAK, isJoinableProse} from './join-paragraph-lines';

/**
 * A convertible item: top-level bullet, single space after the marker, real
 * content, and not a task checkbox.
 */
const SIMPLE_ITEM = /^([-*+]) (?!\[[ xX]\](?: |$))(\S.*)$/;
const LIST_LIKE = /^[ \t]*([-*+]|\d{1,9}[.)])([ \t]|$)/;

function joinItems(items: string[]): string {
  const parts = items.map((s) => s.replace(/[.,;]+$/, '').trim());
  const sentence =
    parts.length === 2 ?
      `${parts[0]} and ${parts[1]}` :
      `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/**
 * The transform shared by the report-only rule and its fix twin. A list run
 * converts only when: every item is a one-line top-level bullet with a
 * consistent marker; there are at least two items; the run is terminated by a
 * blank line or end of document (anything else means a nested list, a lazy
 * continuation, or an adjacent block); the preceding line is not list-related;
 * and no item text could itself re-parse as a list marker.
 *
 * When the preceding line is joinable prose (an intro line ending in a colon,
 * typically), the sentence is appended to it, mirroring what
 * join-paragraph-lines would do to the result; this keeps the rule set
 * convergent when both rules are enabled.
 */
function convertSimpleLists(text: string): string {
  const zones = computeIgnoreZones(text);
  const lines = lineSpans(text);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const first = isLineBlockMasked(zones, line) ? null : SIMPLE_ITEM.exec(line.text);
    if (!first) {
      out.push(line.text);
      i++;
      continue;
    }
    const marker = first[1];
    const items: string[] = [];
    let j = i;
    while (j < lines.length && !isLineBlockMasked(zones, lines[j])) {
      const m = SIMPLE_ITEM.exec(lines[j].text);
      if (!m || m[1] !== marker) break;
      items.push(m[2].trim());
      j++;
    }
    const prev = i > 0 ? lines[i - 1].text : null;
    const term = j < lines.length ? lines[j].text : null;
    const valid =
      items.length >= 2 &&
      (term === null || term.trim() === '') &&
      (prev === null || prev.trim() === '' || (!LIST_LIKE.test(prev) && !/^[ \t]/.test(prev))) &&
      items.every((t) => t !== '' && !LIST_LIKE.test(t));
    if (valid) {
      const sentence = joinItems(items);
      const prevOut = out.length > 0 ? out[out.length - 1] : null;
      const prevMasked = i > 0 && isLineBlockMasked(zones, lines[i - 1]);
      if (
        prevOut !== null &&
        prevOut.trim() !== '' &&
        !prevMasked &&
        isJoinableProse(prevOut) &&
        !INTENTIONAL_BREAK.test(prevOut)
      ) {
        out[out.length - 1] = prevOut.replace(/[ \t]+$/, '') + ' ' + sentence;
      } else {
        out.push(sentence);
      }
      i = j;
    } else {
      while (i < lines.length && lines[i].text.trim() !== '') {
        out.push(lines[i].text);
        i++;
      }
    }
  }
  return out.join('\n');
}

/**
 * Report-only by default, per spec R4. Implemented as two registered rules
 * rather than an option, because reportOnly is a static property the runner
 * reads: `prose-list-to-sentences` is registered reportOnly and only surfaces
 * violations, and the twin id `prose-list-to-sentences-fix` applies the same
 * transform destructively when a profile explicitly enables it.
 *
 * defaultOptions: none for either rule.
 */
export const proseListToSentences: CoreRule = {
  id: 'prose-list-to-sentences',
  category: 'content',
  description:
    'Flag simple one-level bullet lists that could be comma-joined prose; enable prose-list-to-sentences-fix to apply the rewrite.',
  reportOnly: true,
  apply: convertSimpleLists,
  examples: [
    {
      description: 'Simple one-level list becomes one comma-joined sentence',
      before: 'The kit includes:\n- a tent\n- a stove\n- two mats\n',
      after: 'The kit includes: a tent, a stove, and two mats.\n',
    },
    {
      description: 'Two items join with a plain and',
      before: '- apples\n- pears\n',
      after: 'apples and pears.\n',
    },
  ],
};

export const proseListToSentencesFix: CoreRule = {
  id: 'prose-list-to-sentences-fix',
  category: 'content',
  description:
    'Convert simple one-level bullet lists into comma-joined prose sentences; destructive opt-in twin of prose-list-to-sentences.',
  apply: convertSimpleLists,
  examples: [
    {
      description: 'Simple one-level list becomes one comma-joined sentence',
      before: 'The kit includes:\n- a tent\n- a stove\n- two mats\n',
      after: 'The kit includes: a tent, a stove, and two mats.\n',
    },
    {
      description: 'Nested lists are never touched',
      before: '- outer\n  - inner\n- other\n',
      after: '- outer\n  - inner\n- other\n',
    },
    {
      description: 'Task lists are never touched',
      before: '- [ ] todo one\n- [x] done two\n',
      after: '- [ ] todo one\n- [x] done two\n',
    },
    {
      description: 'Lists with multi-line items are never touched',
      before: '- first item\n- second item\nlazy continuation of the item\n',
      after: '- first item\n- second item\nlazy continuation of the item\n',
    },
  ],
};
