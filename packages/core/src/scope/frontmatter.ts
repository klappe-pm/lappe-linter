import {parse} from 'yaml';

/**
 * Top-level frontmatter keys with their parsed YAML values. Values keep their
 * YAML types (string, number, boolean, arrays, nested maps) for predicate
 * evaluation against ProfileMatch.frontmatter.
 */
export type FlatFrontmatter = Record<string, unknown>;

/**
 * Parse raw frontmatter YAML text (without --- fences) into a flat record.
 * Returns null when the input is absent, blank, malformed, or not a YAML
 * mapping; the scope engine treats null as "no frontmatter matches" and
 * never throws on bad input.
 */
export function parseFrontmatter(raw: string | null): FlatFrontmatter | null {
  if (raw === null || raw.trim() === '') {
    return null;
  }
  let doc: unknown;
  try {
    doc = parse(raw);
  } catch {
    return null;
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return null;
  }
  return {...(doc as Record<string, unknown>)};
}
