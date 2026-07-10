import {FileFacts, LinterConfig, ResolvedProfile, RulesConfig} from '../config/types';
import {parseFrontmatter} from './frontmatter';
import {CompiledMatch, compileProfileMatch} from './matchers';

const OVERRIDE_KEY = 'linter-profile';

interface CompiledProfile {
  name: string;
  index: number;
  match: CompiledMatch;
  rules: RulesConfig | undefined;
}

interface CompiledNoteType {
  name: string;
  match: CompiledMatch;
}

interface CompiledConfig {
  profiles: CompiledProfile[];
  byName: Map<string, CompiledProfile>;
  noteTypes: CompiledNoteType[];
}

const compiledCache = new WeakMap<LinterConfig, CompiledConfig>();

const EMPTY_MATCH: CompiledMatch = compileProfileMatch({});

function compiledFor(config: LinterConfig): CompiledConfig {
  const cached = compiledCache.get(config);
  if (cached) {
    return cached;
  }
  const profiles: CompiledProfile[] = Object.entries(config.profiles ?? {}).map(
    ([name, profile], index) => ({
      name,
      index,
      match: profile.match ? compileProfileMatch(profile.match) : EMPTY_MATCH,
      rules: profile.rules,
    }),
  );
  const compiled: CompiledConfig = {
    profiles,
    byName: new Map(profiles.map((p) => [p.name, p])),
    noteTypes: Object.entries(config['note-types'] ?? {}).map(([name, schema]) => ({
      name,
      match: schema.match ? compileProfileMatch(schema.match) : EMPTY_MATCH,
    })),
  };
  compiledCache.set(config, compiled);
  return compiled;
}

function mergeRules(target: RulesConfig, layer: RulesConfig | undefined): void {
  if (!layer) {
    return;
  }
  for (const [ruleId, ruleConfig] of Object.entries(layer)) {
    target[ruleId] = {...target[ruleId], ...ruleConfig};
  }
}

/**
 * Resolve the merged rule configuration for one file. Pure and synchronous:
 * no filesystem, no Obsidian, deterministic for identical inputs.
 *
 * Precedence, low to high: defaults, extension matches, path glob matches
 * (deeper glob wins; depth = count of /-separated segments in the glob),
 * frontmatter and tag matches, then an explicit `linter-profile: <name>`
 * frontmatter key which is applied last regardless of its own matchers.
 * Ties within a level follow declaration order in config.profiles; later
 * declarations merge later and so win key-by-key. An override naming a
 * profile that does not exist is ignored.
 */
export function resolveProfile(facts: FileFacts, config: LinterConfig): ResolvedProfile {
  const compiled = compiledFor(config);
  const frontmatter = parseFrontmatter(facts.frontmatter);

  const matched: Array<{profile: CompiledProfile; rank: number; pathDepth: number}> = [];
  for (const profile of compiled.profiles) {
    const outcome = profile.match.evaluate(facts.path, frontmatter);
    if (outcome.matched) {
      matched.push({profile, rank: profile.match.rank, pathDepth: outcome.pathDepth});
    }
  }
  matched.sort(
    (a, b) =>
      a.rank - b.rank || a.pathDepth - b.pathDepth || a.profile.index - b.profile.index,
  );

  let chain = matched.map((m) => m.profile);
  const overrideRaw = frontmatter?.[OVERRIDE_KEY];
  if (typeof overrideRaw === 'string') {
    const override = compiled.byName.get(overrideRaw);
    if (override) {
      chain = chain.filter((p) => p.name !== override.name);
      chain.push(override);
    }
  }

  const rules: RulesConfig = {};
  mergeRules(rules, config.defaults?.rules);
  for (const profile of chain) {
    mergeRules(rules, profile.rules);
  }

  let noteType: string | undefined;
  for (const candidate of compiled.noteTypes) {
    if (candidate.match.evaluate(facts.path, frontmatter).matched) {
      noteType = candidate.name;
      break;
    }
  }

  const resolved: ResolvedProfile = {
    chain: ['defaults', ...chain.map((p) => p.name)],
    rules,
  };
  if (noteType !== undefined) {
    resolved.noteType = noteType;
  }
  return resolved;
}
