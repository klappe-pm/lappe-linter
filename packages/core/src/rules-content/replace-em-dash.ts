import {CoreRule, CoreRuleOptions} from '../rule';
import {replaceOutsideZones} from './ignore-zones';

export const EM_DASH = String.fromCharCode(0x2014);
export const EN_DASH = String.fromCharCode(0x2013);

/** A run of em or en dashes plus the horizontal whitespace around it. */
const DASH_RUN = new RegExp('[ \\t]*[' + EN_DASH + EM_DASH + ']+[ \\t]*', 'g');

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9]/.test(ch);
}

/**
 * defaultOptions:
 * - `replacement` (string, default ', '): what a connector dash and its
 *   surrounding horizontal whitespace become. Trailing whitespace of the
 *   replacement is trimmed at end of line.
 * - `word-joining` (boolean, default false): when true, a dash directly
 *   between word characters with no surrounding spaces becomes '-' instead
 *   of the replacement.
 *
 * Numeric ranges (digits on both sides of a single en dash) always stay.
 * Line-leading dashes are left alone. Dashes inside code, math, YAML,
 * tables, wikilinks, and URLs are never edited.
 */
export const replaceEmDash: CoreRule = {
  id: 'replace-em-dash',
  category: 'content',
  description:
    'Replace em dashes and connector en dashes with a configured separator (default comma plus space), preserving numeric en dash ranges.',
  defaultOptions: {'replacement': ', ', 'word-joining': false},
  apply: (text, options: CoreRuleOptions) => {
    const replacement = typeof options.replacement === 'string' ? options.replacement : ', ';
    const wordJoining = options['word-joining'] === true;
    return replaceOutsideZones(text, DASH_RUN, (m) => {
      const start = m.index;
      const end = start + m[0].length;
      const before = start > 0 ? text[start - 1] : '';
      const after = end < text.length ? text[end] : '';
      if (before === '' || before === '\n') return m[0];
      const dashes = m[0].replace(/[ \t]/g, '');
      if (dashes === EN_DASH && isDigit(before) && isDigit(after)) return m[0];
      const noSpace = !/[ \t]/.test(m[0]);
      if (wordJoining && noSpace && isWordChar(before) && isWordChar(after)) return '-';
      if (after === '' || after === '\n') return replacement.replace(/[ \t]+$/, '');
      return replacement;
    });
  },
  examples: [
    {
      description: 'Spaced and unspaced em dashes become comma plus space',
      before: `one thing ${EM_DASH} another${EM_DASH}and a third\n`,
      after: 'one thing, another, and a third\n',
    },
    {
      description: 'Connector en dashes are replaced; numeric ranges stay',
      before: `pages 10${EN_DASH}12 cover setup ${EN_DASH} the rest is reference\n`,
      after: `pages 10${EN_DASH}12 cover setup, the rest is reference\n`,
    },
    {
      description: 'word-joining maps tightly joined dashes to a hyphen',
      before: `a rock${EN_DASH}solid plan ${EM_DASH} finally\n`,
      after: 'a rock-solid plan, finally\n',
      options: {'word-joining': true},
    },
    {
      description: 'A custom replacement string',
      before: `cause ${EM_DASH} effect\n`,
      after: 'cause: effect\n',
      options: {replacement: ': '},
    },
    {
      description: 'Dashes in code, math, URLs, and YAML are untouched',
      before: `---\ntitle: a${EM_DASH}b\n---\n\nsee \`x ${EM_DASH} y\` and $a${EM_DASH}b$ at https://ex.com/a${EM_DASH}b ${EM_DASH} done\n`,
      after: `---\ntitle: a${EM_DASH}b\n---\n\nsee \`x ${EM_DASH} y\` and $a${EM_DASH}b$ at https://ex.com/a${EM_DASH}b, done\n`,
    },
    {
      description: 'A dash at end of line drops the trailing space of the replacement',
      before: `trailing ${EM_DASH}\nnext line\n`,
      after: 'trailing,\nnext line\n',
    },
  ],
};
