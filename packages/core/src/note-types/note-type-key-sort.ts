import {CoreRule} from '../rule';
import {
  entriesToLines,
  joinDocument,
  parseFrontmatterData,
  splitDocument,
  splitEntries,
} from './frontmatter';
import {compareRank, rankKey} from './key-rank';
import {keyOrderFrom, schemaFrom} from './schema-option';

export const noteTypeKeySort: CoreRule = {
  id: 'note-type-key-sort',
  category: 'note-type',
  description: 'Order frontmatter keys by the note-type key-order, then the global default order (domain, category, sub-category, date-created, date-revised, remaining alphabetical, aliases and tags last).',
  apply: (text, options) => {
    const schema = schemaFrom(options);
    if (!schema) {
      return text;
    }
    const doc = splitDocument(text);
    if (!doc.has) {
      return text;
    }
    const data = parseFrontmatterData(doc.yamlLines);
    if (data === null) {
      return text;
    }
    const keyOrder = keyOrderFrom(schema);
    const entries = splitEntries(doc.yamlLines);
    const loose = entries.filter((entry) => entry.key === null);
    const keyed = entries
        .map((entry, index) => ({entry, index}))
        .filter(({entry}) => entry.key !== null);
    const sorted = [...keyed].sort(
        (a, b) =>
          compareRank(rankKey(a.entry.key as string, keyOrder), rankKey(b.entry.key as string, keyOrder)) ||
        a.index - b.index,
    );
    const yamlLines = entriesToLines([...loose, ...sorted.map(({entry}) => entry)]);
    return joinDocument({has: true, yamlLines, bodyLines: doc.bodyLines});
  },
  examples: [
    {
      description: 'Keys reorder per schema key-order; body is untouched',
      before: '---\ntags:\n  - x\ndomain: development\n---\nBody.\n',
      after: '---\ndomain: development\ntags:\n  - x\n---\nBody.\n',
      options: {schema: {'key-order': ['domain', 'tags']}},
    },
  ],
};
