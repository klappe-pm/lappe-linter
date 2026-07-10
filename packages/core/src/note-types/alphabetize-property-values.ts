import {CoreRule} from '../rule';
import {
  entriesToLines,
  joinDocument,
  splitDocument,
  splitEntries,
} from './frontmatter';

const BLOCK_ITEM = /^(\s*)- (.*)$/;
const FLOW_ARRAY = /^([^:#]+:\s*)\[(.*)\]\s*$/;

function compareValues(a: string, b: string): number {
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

/** Split a flow array body on top-level commas; null when it looks nested. */
function splitFlowItems(body: string): string[] | null {
  if (body.includes('[') || body.includes(']') || body.includes('"') || body.includes("'")) {
    return null;
  }
  if (body.trim() === '') {
    return [];
  }
  return body.split(',').map((item) => item.trim());
}

/**
 * Alphabetize the VALUES of list properties (aliases, tags, links, and any
 * other list), never the keys; key order is owned by yaml-key-sort (dec-005).
 * Block sequences of flat scalars and simple flow arrays sort case-insensitively;
 * anything nested or quoted is left untouched.
 */
export const alphabetizePropertyValues: CoreRule = {
  id: 'alphabetize-property-values',
  category: 'frontmatter',
  description: 'Alphabetize the values of list properties (aliases, tags, links); keys and non-list values are untouched.',
  apply: (text) => {
    const doc = splitDocument(text);
    if (!doc.has) {
      return text;
    }
    const entries = splitEntries(doc.yamlLines).map((entry) => {
      if (entry.key === null) {
        return entry;
      }
      // Block sequence: `key:` followed only by same-indent `- item` lines.
      if (entry.lines.length > 1) {
        const items = entry.lines.slice(1);
        const matches = items.map((line) => line.match(BLOCK_ITEM));
        const indents = new Set(matches.map((match) => match?.[1]));
        if (matches.every((match) => match !== null) && indents.size === 1) {
          const sorted = [...items].sort((a, b) =>
            compareValues((a.match(BLOCK_ITEM) as RegExpMatchArray)[2], (b.match(BLOCK_ITEM) as RegExpMatchArray)[2]),
          );
          return {key: entry.key, lines: [entry.lines[0], ...sorted]};
        }
        return entry;
      }
      // Simple flow array on one line: `key: [b, a]`.
      const flow = entry.lines[0].match(FLOW_ARRAY);
      if (flow) {
        const items = splitFlowItems(flow[2]);
        if (items !== null && items.length > 1) {
          return {key: entry.key, lines: [`${flow[1]}[${[...items].sort(compareValues).join(', ')}]`]};
        }
      }
      return entry;
    });
    return joinDocument({has: true, yamlLines: entriesToLines(entries), bodyLines: doc.bodyLines});
  },
  examples: [
    {
      description: 'Block-sequence and flow-array values sort; keys stay put',
      before: '---\ntags:\n  - zeta\n  - alpha\naliases: [second, first]\nstatus: DRAFT\n---\nBody.\n',
      after: '---\ntags:\n  - alpha\n  - zeta\naliases: [first, second]\nstatus: DRAFT\n---\nBody.\n',
    },
  ],
};
