/**
 * Frontmatter-derived and context-derived scope predicates (F02 scoping):
 * note age in 5-day buckets, date-created / date-revised ranges, and backlink
 * and alias membership. All pure; the age and date helpers take an explicit
 * `today` so they never read the clock, and the backlink/alias helpers read a
 * caller-supplied context (the Obsidian plugin fills it from the metadata
 * cache; the CLI leaves it empty so those predicates simply never match).
 */

/** External per-file facts the pure core cannot derive from text alone. */
export interface MatchContext {
  /** ISO yyyy-MM-dd "today", for age. */
  today?: string;
  /** Note titles/paths that link to this file. */
  backlinks?: string[];
  /** This file's aliases (frontmatter or otherwise), as resolved by the host. */
  aliases?: string[];
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Parse an ISO yyyy-MM-dd (optionally with a time suffix) to a UTC day number. */
export function isoToDayNumber(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const m = ISO_DATE.exec(value.trim());
  if (m == null) {
    return null;
  }
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const ms = Date.UTC(year, month - 1, day);
  const parsed = new Date(ms);
  if (!Number.isFinite(ms) || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null;
  }
  return Math.floor(ms / 86400000);
}

/**
 * The 5-day bucket label for a given age in days. A note created today (age 0
 * or negative) rounds up to 1, landing in the "1-5" bucket.
 */
export function ageBucketForDays(days: number): string {
  const d = days < 1 ? 1 : Math.floor(days);
  const lower = Math.floor((d - 1) / 5) * 5 + 1;
  return `${lower}-${lower + 4}`;
}

/** The age bucket for a note created on `createdIso` as of `todayIso`, or null. */
export function ageBucket(createdIso: unknown, todayIso: unknown): string | null {
  const created = isoToDayNumber(createdIso);
  const today = isoToDayNumber(todayIso);
  if (created === null || today === null) {
    return null;
  }
  return ageBucketForDays(today - created);
}

/** True when `dateIso` falls within [after, before] inclusive; open-ended sides are ignored. */
export function dateInRange(dateIso: unknown, range: {after?: string; before?: string}): boolean {
  const day = isoToDayNumber(dateIso);
  if (day === null) {
    return false;
  }
  const after = range.after === undefined ? null : isoToDayNumber(range.after);
  const before = range.before === undefined ? null : isoToDayNumber(range.before);
  if ((range.after !== undefined && after === null) || (range.before !== undefined && before === null)) {
    return false;
  }
  if (after !== null && before !== null && after > before) {
    return false;
  }
  if (after !== null && day < after) {
    return false;
  }
  if (before !== null && day > before) {
    return false;
  }
  return true;
}

/** True when any wanted value is present in the actual list (case-insensitive). */
export function listIncludesAny(wanted: string[], actual: string[] | undefined): boolean {
  if (!actual || actual.length === 0) {
    return false;
  }
  const have = new Set(actual.map((v) => v.toLowerCase()));
  return wanted.some((w) => have.has(w.toLowerCase()));
}
