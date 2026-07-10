import {NoteTypeSchema} from '../config/types';
import {CoreRule} from '../rule';
import {parseFrontmatterData, splitDocument} from './frontmatter';
import {schemaFrom} from './schema-option';

function isMap(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Structured violation messages, one per problem, formatted 'key: problem'.
 * The plugin Notice and the CLI consume this directly; the registered rule
 * only signals presence of violations to the runner.
 */
export function collectNoteTypeViolations(text: string, schema: NoteTypeSchema): string[] {
  const doc = splitDocument(text);
  const data = parseFrontmatterData(doc.yamlLines);
  if (data === null) {
    return ['frontmatter: invalid YAML or not a flat mapping'];
  }
  const messages: string[] = [];

  const managed = new Set<string>([
    ...Object.keys(schema.required ?? {}),
    ...Object.keys(schema.values ?? {}),
  ]);
  const dateKeys = schema['date-keys'];
  if (dateKeys?.created) {
    managed.add(dateKeys.created);
  }
  if (dateKeys?.revised) {
    managed.add(dateKeys.revised);
  }

  for (const key of managed) {
    if (!(key in data)) {
      continue;
    }
    const value = data[key];
    if (isMap(value)) {
      messages.push(`${key}: nested maps are not allowed in managed keys`);
      continue;
    }
    if (Array.isArray(value) && value.some((item) => item !== null && typeof item === 'object')) {
      messages.push(`${key}: list items must be flat scalars`);
    }
  }

  for (const [key, allowed] of Object.entries(schema.values ?? {})) {
    if (!(key in data) || !Array.isArray(allowed)) {
      continue;
    }
    const value = data[key];
    if (value === null || value === undefined || isMap(value)) {
      continue;
    }
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (item === null || typeof item === 'object') {
        continue;
      }
      if (!allowed.some((candidate) => candidate === item)) {
        messages.push(`${key}: value ${JSON.stringify(item)} is not one of [${allowed.join(', ')}]`);
      }
    }
  }

  for (const [key, defaultValue] of Object.entries(schema.required ?? {})) {
    if (defaultValue === null && !(key in data)) {
      messages.push(`${key}: required key is missing and has no default`);
    }
  }

  return messages;
}

export const noteTypeValidate: CoreRule = {
  id: 'note-type-validate',
  category: 'note-type',
  description: 'Report note-type frontmatter violations: enum constraints, nested maps in managed keys, and missing required keys without defaults.',
  reportOnly: true,
  apply: (text, options) => {
    const schema = schemaFrom(options);
    if (!schema) {
      return text;
    }
    const messages = collectNoteTypeViolations(text, schema);
    if (messages.length === 0) {
      return text;
    }
    return `${text}\n<!-- note-type-validate\n${messages.join('\n')}\n-->`;
  },
};
