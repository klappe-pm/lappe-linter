import {CoreRule} from '../rule';
import {
  FlatScalar,
  entriesToLines,
  formatEntryLines,
  joinDocument,
  parseFrontmatterData,
  splitDocument,
  splitEntries,
} from './frontmatter';
import {compareRank, insertRanked, rankKey} from './key-rank';

/**
 * Global frontmatter key sorter (no note type required). One combined
 * control: `priority-keys` is the order YAML keys get sorted in; unlisted
 * keys follow alphabetically with aliases and tags last. `defaults` may map
 * a key to a value inserted at its ranked position when the key is absent;
 * existing values are never overwritten. The Lappe settings tab edits this
 * rule's stanza in linter.yaml.
 */
export const yamlKeySort: CoreRule = {
  id: 'yaml-key-sort',
  category: 'frontmatter',
  description: 'Sort frontmatter keys into the configured order (priority-keys first, remaining alphabetical, aliases and tags last), inserting configured default keys when absent.',
  defaultOptions: {'priority-keys': [], 'defaults': {}},
  apply: (text, options) => {
    const priorityKeys = Array.isArray(options['priority-keys']) ?
      (options['priority-keys'] as string[]).filter((key) => typeof key === 'string') :
      [];
    const defaults =
      options['defaults'] && typeof options['defaults'] === 'object' && !Array.isArray(options['defaults']) ?
        (options['defaults'] as Record<string, FlatScalar | Array<FlatScalar> | null>) :
        {};

    const doc = splitDocument(text);
    if (!doc.has) {
      return text;
    }
    const data = parseFrontmatterData(doc.yamlLines);
    if (data === null) {
      return text;
    }

    const loose = splitEntries(doc.yamlLines).filter((entry) => entry.key === null);
    const keyed = splitEntries(doc.yamlLines)
        .map((entry, index) => ({entry, index}))
        .filter(({entry}) => entry.key !== null);
    let sorted = [...keyed]
        .sort(
            (a, b) =>
              compareRank(rankKey(a.entry.key as string, priorityKeys), rankKey(b.entry.key as string, priorityKeys)) ||
          a.index - b.index,
        )
        .map(({entry}) => entry);

    for (const [key, value] of Object.entries(defaults)) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      sorted = insertRanked(sorted, {key, lines: formatEntryLines(key, value)}, priorityKeys);
    }

    const yamlLines = entriesToLines([...loose, ...sorted]);
    return joinDocument({has: true, yamlLines, bodyLines: doc.bodyLines});
  },
  examples: [
    {
      description: 'Keys sort by priority order, remaining alphabetical, tags last',
      before: '---\ntags:\n  - x\nstatus: DRAFT\ndomain: development\ncategory: notes\n---\nBody.\n',
      after: '---\ndomain: development\ncategory: notes\nstatus: DRAFT\ntags:\n  - x\n---\nBody.\n',
      options: {'priority-keys': ['domain', 'category']},
    },
    {
      description: 'A configured default is inserted at its ranked position when the key is absent',
      before: '---\ndomain: development\n---\nBody.\n',
      after: '---\ndomain: development\nstatus: DRAFT\n---\nBody.\n',
      options: {'priority-keys': ['domain', 'status'], 'defaults': {status: 'DRAFT'}},
    },
  ],
};
