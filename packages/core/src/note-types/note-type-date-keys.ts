import {CoreRule} from '../rule';
import {
  entriesToLines,
  joinDocument,
  parseFrontmatterData,
  splitDocument,
  splitEntries,
} from './frontmatter';
import {insertRanked} from './key-rank';
import {keyOrderFrom, schemaFrom} from './schema-option';

/** Drop one top-level frontmatter key so texts can be compared without it. */
function normalizeOutKey(text: string, key: string): string {
  const doc = splitDocument(text);
  if (!doc.has) {
    return text;
  }
  const entries = splitEntries(doc.yamlLines).filter((entry) => entry.key !== key);
  return joinDocument({has: true, yamlLines: entriesToLines(entries), bodyLines: doc.bodyLines});
}

/**
 * Churn guard (spec R3): the revised key updates only when this run changed
 * content other than the revised key itself. The caller injects `today` as an
 * ISO date string and `originalText` as the file's pre-run text; without
 * `originalText` the rule compares against its own input, so a clean file is
 * always returned byte-identical.
 */
export const noteTypeDateKeys: CoreRule = {
  id: 'note-type-date-keys',
  category: 'note-type',
  description: 'Set the created date key on first lint when absent and bump the revised date key only when the run changed other content.',
  apply: (text, options) => {
    const schema = schemaFrom(options);
    const dateKeys = schema?.['date-keys'];
    const today = typeof options['today'] === 'string' ? options['today'] : null;
    if (!schema || !dateKeys || !today) {
      return text;
    }
    const original = typeof options['originalText'] === 'string' ? options['originalText'] : text;
    const keyOrder = keyOrderFrom(schema);
    let out = text;

    const created = dateKeys.created;
    if (created) {
      const doc = splitDocument(out);
      const data = parseFrontmatterData(doc.yamlLines);
      if (data !== null && !(created in data)) {
        const entries = insertRanked(
            splitEntries(doc.yamlLines),
            {key: created, lines: [`${created}: ${today}`]},
            keyOrder,
        );
        out = joinDocument({has: true, yamlLines: entriesToLines(entries), bodyLines: doc.bodyLines});
      }
    }

    const revised = dateKeys.revised;
    if (revised && normalizeOutKey(original, revised) !== normalizeOutKey(out, revised)) {
      const doc = splitDocument(out);
      const data = parseFrontmatterData(doc.yamlLines);
      if (data !== null) {
        const line = `${revised}: ${today}`;
        let entries = splitEntries(doc.yamlLines);
        const existing = entries.findIndex((entry) => entry.key === revised);
        if (existing >= 0) {
          entries = entries.map((entry, index) =>
            index === existing ? {key: revised, lines: [line]} : entry,
          );
        } else {
          entries = insertRanked(entries, {key: revised, lines: [line]}, keyOrder);
        }
        out = joinDocument({has: true, yamlLines: entriesToLines(entries), bodyLines: doc.bodyLines});
      }
    }

    return out;
  },
  examples: [
    {
      description: 'First lint of a file without date keys sets created and revised',
      before: '---\ntype: task\n---\nBody.\n',
      after: '---\ndate-created: 2026-07-10\ndate-revised: 2026-07-10\ntype: task\n---\nBody.\n',
      options: {
        schema: {'date-keys': {created: 'date-created', revised: 'date-revised'}},
        today: '2026-07-10',
        originalText: '---\ntype: task\n---\nBody.\n',
      },
    },
  ],
};
