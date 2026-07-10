import {CoreRule, CoreRuleOptions} from '../rule';
import {computeIgnoreZones, isLineBlockMasked, lineSpans} from './ignore-zones';

/**
 * Per-level heading case formatter. Each ATX heading (# .. ######) can be
 * normalized to one of five styles, chosen per level via options h1..h6. An
 * unset (or empty) level is left untouched. Headings inside code fences,
 * math blocks, tables, or frontmatter are never edited.
 */

export type HeaderCaseStyle =
  | 'camelCase'
  | 'First letter'
  | 'kebab-case'
  | 'Title Case'
  | 'underscore_formatted';

export const HEADER_CASE_STYLES: HeaderCaseStyle[] = [
  'camelCase',
  'First letter',
  'kebab-case',
  'Title Case',
  'underscore_formatted',
];

// Split a heading into words on whitespace and existing kebab/underscore/camel
// boundaries, so re-formatting between styles is stable and idempotent.
function toWords(text: string): string[] {
  return text
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(/[\s_-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Format one heading's text (the part after the # markers) into a style.
 * Pure and idempotent: formatting an already-formatted heading is a no-op.
 */
export function formatHeadingText(text: string, style: HeaderCaseStyle): string {
  const words = toWords(text);
  if (words.length === 0) {
    return text.trim();
  }
  switch (style) {
    case 'camelCase':
      return words.map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w))).join('');
    case 'First letter':
      return capitalize(words.map((w) => w.toLowerCase()).join(' '));
    case 'kebab-case':
      return words.map((w) => w.toLowerCase()).join('-');
    case 'Title Case':
      return words.map((w) => capitalize(w)).join(' ');
    case 'underscore_formatted':
      return words.map((w) => w.toLowerCase()).join('_');
  }
}

function isStyle(value: unknown): value is HeaderCaseStyle {
  return typeof value === 'string' && (HEADER_CASE_STYLES as string[]).includes(value);
}

const ATX_HEADING = /^(\s{0,3})(#{1,6})(\s+)(.*?)(\s*)$/;

export const headerCase: CoreRule = {
  id: 'header-case',
  category: 'content',
  description: 'Normalize each ATX heading level to a chosen case style (camelCase, First letter, kebab-case, Title Case, underscore_formatted); levels left unset are untouched, and headings in code, math, tables, or frontmatter are never edited.',
  defaultOptions: {h1: '', h2: '', h3: '', h4: '', h5: '', h6: ''},
  apply: (text, options: CoreRuleOptions) => {
    const styleForLevel = (level: number): HeaderCaseStyle | null => {
      const value = options[`h${level}`];
      return isStyle(value) ? value : null;
    };
    if (![1, 2, 3, 4, 5, 6].some((level) => styleForLevel(level) !== null)) {
      return text;
    }

    const zones = computeIgnoreZones(text);
    const spans = lineSpans(text);
    let out = '';
    let last = 0;
    for (const span of spans) {
      if (isLineBlockMasked(zones, span)) {
        continue;
      }
      const match = ATX_HEADING.exec(span.text);
      if (match == null) {
        continue;
      }
      const level = match[2].length;
      const style = styleForLevel(level);
      if (style == null || match[4].length === 0) {
        continue;
      }
      const formatted = formatHeadingText(match[4], style);
      if (formatted === match[4]) {
        continue;
      }
      const rebuilt = `${match[1]}${match[2]}${match[3]}${formatted}`;
      out += text.slice(last, span.start) + rebuilt;
      last = span.end;
    }
    return out + text.slice(last);
  },
  examples: [
    {
      description: 'H1 to kebab-case, H2 to camelCase',
      before: '# My Great Note\n\n## Some Section Here\n\nbody\n',
      after: '# my-great-note\n\n## someSectionHere\n\nbody\n',
      options: {h1: 'kebab-case', h2: 'camelCase'},
    },
    {
      description: 'Title Case and First letter',
      before: '# the quick brown fox\n\n## the QUICK brown fox\n',
      after: '# The Quick Brown Fox\n\n## The quick brown fox\n',
      options: {h1: 'Title Case', h2: 'First letter'},
    },
    {
      description: 'Headings in code fences are untouched',
      before: '```\n# Not A Heading\n```\n\n# Real Heading\n',
      after: '```\n# Not A Heading\n```\n\n# real-heading\n',
      options: {h1: 'kebab-case'},
    },
  ],
};
