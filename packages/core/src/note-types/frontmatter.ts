import {parse as parseYamlSource, stringify as stringifyYamlValue} from 'yaml';

/**
 * Line-preserving frontmatter access. The document is split into lines once;
 * the body is only ever carried through verbatim, so any file the rules do
 * not change is returned byte-identical.
 */
export interface FrontmatterDoc {
  has: boolean;
  yamlLines: string[];
  bodyLines: string[];
}

export function splitDocument(text: string): FrontmatterDoc {
  const lines = text.split('\n');
  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        return {has: true, yamlLines: lines.slice(1, i), bodyLines: lines.slice(i + 1)};
      }
    }
  }
  return {has: false, yamlLines: [], bodyLines: lines};
}

export function joinDocument(doc: FrontmatterDoc): string {
  if (!doc.has) {
    return doc.bodyLines.join('\n');
  }
  return ['---', ...doc.yamlLines, '---', ...doc.bodyLines].join('\n');
}

/**
 * One top-level frontmatter mapping entry with its exact source lines.
 * `key: null` holds loose lines before the first key (comments, blanks).
 */
export interface YamlEntry {
  key: string | null;
  lines: string[];
}

// The bare-key alternative must stay linear: an earlier lazy form
// ([^:]*?) next to \s*: backtracked quadratically on long colon-free
// whitespace runs, a ReDoS reachable from any note's frontmatter. The
// (?:[^:]*[^\s:])? shape pins the key's last character to a non-space so
// every failure position is checked once.
const KEY_LINE = /^(?:"([^"]+)"|'([^']+)'|([^\s#:-](?:[^:]*[^\s:])?))\s*:(?:\s|$)/;

export function splitEntries(yamlLines: string[]): YamlEntry[] {
  const entries: YamlEntry[] = [];
  let current: YamlEntry | null = null;
  for (const line of yamlLines) {
    // Every KEY_LINE alternative requires a colon; indexOf is a cheap linear
    // bail-out that keeps pathological colon-free lines away from the regex.
    const match = line.indexOf(':') === -1 ? null : line.match(KEY_LINE);
    if (match) {
      if (current) {
        entries.push(current);
      }
      current = {key: match[1] ?? match[2] ?? match[3].trim(), lines: [line]};
    } else if (current) {
      current.lines.push(line);
    } else {
      current = {key: null, lines: [line]};
    }
  }
  if (current) {
    entries.push(current);
  }
  return entries;
}

export function entriesToLines(entries: YamlEntry[]): string[] {
  return entries.flatMap((entry) => entry.lines);
}

/**
 * Parse the frontmatter mapping. Returns {} when there is no frontmatter and
 * null when the YAML is invalid or not a mapping, so rules can bail safely.
 */
export function parseFrontmatterData(yamlLines: string[]): Record<string, unknown> | null {
  if (yamlLines.length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = parseYamlSource(yamlLines.join('\n'));
  } catch {
    return null;
  }
  if (parsed === null || parsed === undefined) {
    return {};
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

export type FlatScalar = string | number | boolean;

export function formatScalar(value: FlatScalar): string {
  return stringifyYamlValue(value).trimEnd();
}

/**
 * Render one entry in the house style: empty arrays as `key:` with no `[]`,
 * non-empty arrays as two-space-indented block sequences.
 */
export function formatEntryLines(
  key: string,
  value: FlatScalar | Array<FlatScalar> | null,
): string[] {
  if (value === null) {
    return [`${key}:`];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${key}:`];
    }
    return [`${key}:`, ...value.map((item) => `  - ${formatScalar(item)}`)];
  }
  return [`${key}: ${formatScalar(value)}`];
}
