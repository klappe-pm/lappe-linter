import {YamlEntry} from './frontmatter';

/**
 * Global default key order: these lead when the schema's key-order does not
 * claim them; unlisted keys sort alphabetically; aliases and tags go last.
 * When a config lists aliases/tags in priority-keys they rank there instead
 * (explicit wins in rankKey); this head only governs vaults with no config.
 */
export const GLOBAL_KEY_ORDER_HEAD = [
  'preset',
  'domain',
  'category',
  'sub-category',
  'types',
  'date-created',
  'date-revised',
  'links',
];

export interface KeyRank {
  group: number;
  sub: number | string;
}

export function rankKey(key: string, keyOrder: string[]): KeyRank {
  const explicit = keyOrder.indexOf(key);
  if (explicit >= 0) {
    return {group: 0, sub: explicit};
  }
  const head = GLOBAL_KEY_ORDER_HEAD.indexOf(key);
  if (head >= 0) {
    return {group: 1, sub: head};
  }
  if (key === 'aliases') {
    return {group: 3, sub: 0};
  }
  if (key === 'tags') {
    return {group: 3, sub: 1};
  }
  return {group: 2, sub: key.toLowerCase()};
}

export function compareRank(a: KeyRank, b: KeyRank): number {
  if (a.group !== b.group) {
    return a.group - b.group;
  }
  if (typeof a.sub === 'number' && typeof b.sub === 'number') {
    return a.sub - b.sub;
  }
  const left = String(a.sub);
  const right = String(b.sub);
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Insert a new entry at its ranked position among existing keyed entries.
 * Loose (null-key) entries stay where they are; ties append after equals so
 * repeated insertion stays stable.
 */
export function insertRanked(entries: YamlEntry[], entry: YamlEntry, keyOrder: string[]): YamlEntry[] {
  if (entry.key === null) {
    return [...entries, entry];
  }
  const newRank = rankKey(entry.key, keyOrder);
  const index = entries.findIndex(
      (existing) => existing.key !== null && compareRank(rankKey(existing.key, keyOrder), newRank) > 0,
  );
  const out = [...entries];
  out.splice(index === -1 ? out.length : index, 0, entry);
  return out;
}
