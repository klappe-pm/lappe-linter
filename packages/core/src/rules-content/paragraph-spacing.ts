import {CoreRule, CoreRuleOptions} from '../rule';
import {computeIgnoreZones, isLineBlockMasked, lineSpans} from './ignore-zones';

/**
 * Normalize the number of blank lines between blocks to a fixed count (0, 1,
 * or 2; default 1). Runs of blank lines in unmasked regions collapse (or
 * expand) to exactly the configured count; leading and trailing blank lines
 * are trimmed. Blank lines inside code fences, math blocks, tables, and
 * frontmatter are masked and preserved verbatim.
 */

function clampCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(2, Math.max(0, Math.round(n)));
}

export const paragraphSpacing: CoreRule = {
  id: 'paragraph-spacing',
  category: 'content',
  description: 'Normalize blank lines between blocks to a fixed count (0, 1, or 2); trims leading and trailing blank lines and preserves blank lines inside code, math, tables, and frontmatter.',
  defaultOptions: {'blank-lines': 1},
  apply: (text, options: CoreRuleOptions) => {
    const count = clampCount(options['blank-lines']);
    const zones = computeIgnoreZones(text);
    const lines = lineSpans(text);
    const out: string[] = [];
    let blankRun = 0;
    let seenContent = false;
    for (const line of lines) {
      const masked = isLineBlockMasked(zones, line);
      const isBlank = !masked && line.text.trim() === '';
      if (isBlank) {
        blankRun++;
        continue;
      }
      if (seenContent && blankRun > 0) {
        for (let i = 0; i < count; i++) {
          out.push('');
        }
      }
      blankRun = 0;
      out.push(line.text);
      seenContent = true;
    }
    const result = out.join('\n');
    return text.endsWith('\n') && result.length > 0 ? result + '\n' : result;
  },
  examples: [
    {
      description: 'Collapse multiple blank lines to one',
      before: 'first\n\n\n\nsecond\n',
      after: 'first\n\nsecond\n',
    },
    {
      description: 'Zero blank lines closes the gap',
      before: 'first\n\nsecond\n',
      after: 'first\nsecond\n',
      options: {'blank-lines': 0},
    },
    {
      description: 'Two blank lines are enforced where a gap exists',
      before: 'first\n\nsecond\n',
      after: 'first\n\n\nsecond\n',
      options: {'blank-lines': 2},
    },
    {
      description: 'Blank lines inside a code fence are preserved',
      before: '```\ncode\n\n\nmore\n```\n\n\ntext\n',
      after: '```\ncode\n\n\nmore\n```\n\ntext\n',
    },
  ],
};
