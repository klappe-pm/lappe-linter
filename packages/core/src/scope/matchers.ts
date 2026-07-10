import {ProfileMatch} from '../config/types';
import {FlatFrontmatter} from './frontmatter';

/**
 * Precedence rank of a compiled matcher, low to high. A profile whose match
 * combines kinds takes the rank of its strongest kind; tag predicates rank
 * with frontmatter because both read parsed frontmatter.
 */
export const RANK_NONE = 0;
export const RANK_EXTENSION = 1;
export const RANK_PATH = 2;
export const RANK_FRONTMATTER = 3;

export type MatcherRank =
  | typeof RANK_NONE
  | typeof RANK_EXTENSION
  | typeof RANK_PATH
  | typeof RANK_FRONTMATTER;

export interface MatchEvaluation {
  matched: boolean;
  /** Max segment depth among matched path globs; 0 when no path kind. */
  pathDepth: number;
}

export interface CompiledMatch {
  rank: MatcherRank;
  evaluate(path: string, frontmatter: FlatFrontmatter | null): MatchEvaluation;
}

const NO_MATCH: MatchEvaluation = {matched: false, pathDepth: 0};

const REGEXP_SPECIALS = /[.+^${}()|[\]\\]/;

function segmentToRegExp(segment: string): RegExp {
  let source = '^';
  for (const ch of segment) {
    if (ch === '*') {
      source += '[^/]*';
    } else if (ch === '?') {
      source += '[^/]';
    } else {
      source += REGEXP_SPECIALS.test(ch) ? `\\${ch}` : ch;
    }
  }
  return new RegExp(source + '$');
}

export interface CompiledGlob {
  glob: string;
  /** Count of /-separated segments in the glob; deeper outranks shallower. */
  depth: number;
  test(path: string): boolean;
}

/**
 * Minimal glob matcher over /-separated vault-relative paths. Supports `**`
 * (zero or more whole segments, so `a/**` also matches `a` itself), `*`
 * (any run of characters within one segment), and `?` (one character within
 * a segment). No brace expansion, extglobs, or character classes.
 */
export function compileGlob(glob: string): CompiledGlob {
  // Consecutive ** segments are redundant (a/**/**/b matches exactly what
  // a/**/b matches); collapsing them keeps the matcher's worst case small.
  const parts: Array<RegExp | '**'> = [];
  for (const seg of glob.split('/')) {
    const part = seg === '**' ? '**' : segmentToRegExp(seg);
    if (part === '**' && parts[parts.length - 1] === '**') {
      continue;
    }
    parts.push(part);
  }

  // Greedy two-pointer wildcard match (backtrack only to the most recent **),
  // O(segments * parts). The previous recursive form re-tried every skip
  // offset per **, which went exponential on globs stacking several **
  // segments, a hang reachable from linter.yaml / style-file match.path.
  function matchSegments(segments: string[]): boolean {
    let si = 0;
    let pi = 0;
    let starPi = -1;
    let starSi = 0;
    while (si < segments.length) {
      const part = pi < parts.length ? parts[pi] : null;
      if (part === '**') {
        starPi = pi;
        starSi = si;
        pi++;
      } else if (part !== null && part.test(segments[si])) {
        pi++;
        si++;
      } else if (starPi >= 0) {
        starSi++;
        si = starSi;
        pi = starPi + 1;
      } else {
        return false;
      }
    }
    while (pi < parts.length && parts[pi] === '**') {
      pi++;
    }
    return pi === parts.length;
  }

  return {
    glob,
    depth: glob.split('/').length,
    test: (path) => matchSegments(path.split('/')),
  };
}

function extensionOf(path: string): string | null {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : null;
}

type Scalar = string | number | boolean;

function frontmatterValueMatches(expected: Scalar | Scalar[], actual: unknown): boolean {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.every((e) => actual.some((a) => a === e));
  }
  if (Array.isArray(actual)) {
    return actual.some((a) => a === expected);
  }
  return actual === expected;
}

function normalizeTag(tag: Scalar): string {
  return String(tag).replace(/^#/, '');
}

function tagsOf(frontmatter: FlatFrontmatter): string[] {
  const raw = frontmatter['tags'] ?? frontmatter['tag'];
  if (Array.isArray(raw)) {
    return raw
      .filter((v): v is Scalar =>
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .map(normalizeTag);
  }
  if (typeof raw === 'string') {
    return raw.split(/[,\s]+/).filter(Boolean).map(normalizeTag);
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return [normalizeTag(raw)];
  }
  return [];
}

/**
 * Compile a ProfileMatch into a predicate. Every kind present must match
 * (AND across kinds); within one kind, any listed alternative suffices (OR).
 * An empty match compiles to rank 0 and never matches, so such a profile
 * applies only via the explicit `linter-profile` frontmatter override.
 */
export function compileProfileMatch(match: ProfileMatch): CompiledMatch {
  const extensions = match.extension?.length
    ? new Set(match.extension.map((e) => e.toLowerCase()))
    : null;
  const globs = match.path?.length ? match.path.map(compileGlob) : null;
  const frontmatterEntries = match.frontmatter && Object.keys(match.frontmatter).length
    ? Object.entries(match.frontmatter)
    : null;
  const wantedTags = match.tag?.length ? match.tag.map(normalizeTag) : null;

  const rank: MatcherRank =
    frontmatterEntries || wantedTags ? RANK_FRONTMATTER :
    globs ? RANK_PATH :
    extensions ? RANK_EXTENSION :
    RANK_NONE;

  return {
    rank,
    evaluate(path, frontmatter) {
      if (rank === RANK_NONE) {
        return NO_MATCH;
      }
      if (extensions) {
        const ext = extensionOf(path);
        if (ext === null || !extensions.has(ext)) {
          return NO_MATCH;
        }
      }
      let pathDepth = 0;
      if (globs) {
        for (const g of globs) {
          if (g.test(path) && g.depth > pathDepth) {
            pathDepth = g.depth;
          }
        }
        if (pathDepth === 0) {
          return NO_MATCH;
        }
      }
      if (frontmatterEntries) {
        if (frontmatter === null) {
          return NO_MATCH;
        }
        for (const [key, expected] of frontmatterEntries) {
          if (!frontmatterValueMatches(expected, frontmatter[key])) {
            return NO_MATCH;
          }
        }
      }
      if (wantedTags) {
        if (frontmatter === null) {
          return NO_MATCH;
        }
        const present = tagsOf(frontmatter);
        if (!wantedTags.some((t) => present.includes(t))) {
          return NO_MATCH;
        }
      }
      return {matched: true, pathDepth};
    },
  };
}
