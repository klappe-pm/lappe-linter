import {Document, parseDocument} from 'yaml';

/**
 * Apply a mutation to a linter.yaml text through the yaml Document API,
 * preserving comments, key order, and unknown keys. Use doc.setIn / doc.get
 * inside `mutate`; the untouched parts of the document round-trip verbatim.
 */
export function updateConfigText(yamlText: string, mutate: (doc: Document) => void): string {
  const doc = parseDocument(yamlText, {keepSourceTokens: true});
  if (doc.errors.length > 0) {
    throw new Error(`cannot update malformed yaml: ${doc.errors[0].message}`);
  }
  mutate(doc);
  return doc.toString();
}
