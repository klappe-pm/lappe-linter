/**
 * Scope engine barrel (F02). The integrator re-exports this from the core
 * barrel; nothing here registers rules or has import side effects.
 */

export {parseFrontmatter, FlatFrontmatter} from './frontmatter';
export {
  CompiledGlob,
  CompiledMatch,
  MatchEvaluation,
  MatcherRank,
  RANK_EXTENSION,
  RANK_FRONTMATTER,
  RANK_NONE,
  RANK_PATH,
  compileGlob,
  compileProfileMatch,
} from './matchers';
export {resolveProfile} from './resolver';
export {
  MatchContext,
  ageBucket,
  ageBucketForDays,
  dateInRange,
  isoToDayNumber,
  listIncludesAny,
} from './advanced-matchers';
