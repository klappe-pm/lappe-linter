/**
 * The single naming function for lappe-linter (spec F04 R4). Every surface
 * that proposes or executes a rename (plugin, CLI, harness scripts) derives
 * the target name from `kebabCaseName` and resolves clashes with
 * `resolveCollision`. Pure string logic, no filesystem access.
 */

const RESERVED_STEMS = new Set([
  'README',
  'CLAUDE',
  'SKILL',
  'PASSOFF',
  'GIT-STRATEGY',
  'PR-STANDARDS',
  'MEMORY',
  'AGENTS',
  'CODEX',
]);

/** Case-sensitive exact-stem match against the reserved literal names. */
export function isReservedStem(stem: string): boolean {
  return RESERVED_STEMS.has(stem);
}

/**
 * Unicode-aware kebab-case slug of a filename stem: camelCase boundaries and
 * whitespace/underscores become hyphens, diacritics fold to their base letter
 * (NFKD), punctuation and symbols (emoji included) are stripped, repeated
 * hyphens collapse, and leading/trailing hyphens are trimmed. Reserved
 * literal stems pass through unchanged.
 */
export function kebabCaseName(stem: string): string {
  if (RESERVED_STEMS.has(stem)) {
    return stem;
  }
  return stem
      .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1-$2')
      .replace(/([\p{Ll}\p{Nd}])(\p{Lu})/gu, '$1-$2')
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\p{L}\p{N}-]+/gu, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
}

/**
 * Append `-2`, `-3`, ... until the proposed stem is free. `taken` is the set
 * of stems already occupied in the target folder (caller-built; core never
 * scans the disk).
 */
export function resolveCollision(proposed: string, taken: Set<string>): string {
  if (!taken.has(proposed)) {
    return proposed;
  }
  let suffix = 2;
  while (taken.has(`${proposed}-${suffix}`)) {
    suffix += 1;
  }
  return `${proposed}-${suffix}`;
}
