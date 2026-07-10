import {CoreRule} from '../rule';
import {
  entriesToLines,
  formatEntryLines,
  joinDocument,
  parseFrontmatterData,
  splitDocument,
  splitEntries,
} from './frontmatter';
import {insertRanked} from './key-rank';
import {keyOrderFrom, schemaFrom} from './schema-option';

export const noteTypeInsertKeys: CoreRule = {
  id: 'note-type-insert-keys',
  category: 'note-type',
  description: 'Insert required note-type frontmatter keys with their schema defaults when absent; existing values are never overwritten.',
  apply: (text, options) => {
    const schema = schemaFrom(options);
    const required = schema?.required;
    if (!schema || !required) {
      return text;
    }
    const doc = splitDocument(text);
    const data = parseFrontmatterData(doc.yamlLines);
    if (data === null) {
      return text;
    }
    const inserts = Object.entries(required).filter(
        ([key, defaultValue]) => defaultValue !== null && !(key in data),
    );
    if (inserts.length === 0) {
      return text;
    }
    const keyOrder = keyOrderFrom(schema);
    let entries = splitEntries(doc.yamlLines);
    for (const [key, defaultValue] of inserts) {
      entries = insertRanked(entries, {key, lines: formatEntryLines(key, defaultValue)}, keyOrder);
    }
    return joinDocument({has: true, yamlLines: entriesToLines(entries), bodyLines: doc.bodyLines});
  },
  examples: [
    {
      description: 'Missing status gets the schema default; existing keys stay untouched',
      before: '---\ndomain: development\n---\nBody.\n',
      after: '---\ndomain: development\nstatus: NEW\n---\nBody.\n',
      options: {schema: {required: {status: 'NEW'}}},
    },
  ],
};
