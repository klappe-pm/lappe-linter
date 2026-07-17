import {
  FileFacts,
  GlobalTemplate,
  LinterConfig,
  ScopedTemplate,
  TemplateFrontmatterValue,
  TemplatesConfig,
} from '../config/types';
import {parseFrontmatter} from '../scope/frontmatter';
import {compileProfileMatch} from '../scope/matchers';
import {ResolvedTemplate} from './types';

function toggledOff(value: boolean | 'on' | 'off' | undefined): boolean {
  return value === false || value === 'off';
}

/**
 * Pick the single scoped template that applies to a file. Templates are not
 * merged into a chain the way profiles are: a note gets exactly one property
 * template. Selection mirrors profile precedence — strongest matcher rank
 * wins, then deepest path glob, then declaration order — and the highest such
 * match is chosen so a more specific scope overrides a broader one.
 */
function selectScoped(
    templates: ScopedTemplate[],
    facts: FileFacts,
): ScopedTemplate | null {
  const frontmatter = parseFrontmatter(facts.frontmatter);
  const context = {today: facts.today, backlinks: facts.backlinks, aliases: facts.aliases};
  const matched: Array<{template: ScopedTemplate; rank: number; pathDepth: number; index: number}> = [];
  templates.forEach((template, index) => {
    if (!template.match) {
      return;
    }
    const compiled = compileProfileMatch(template.match);
    const outcome = compiled.evaluate(facts.path, frontmatter, context);
    if (outcome.matched) {
      matched.push({template, rank: compiled.rank, pathDepth: outcome.pathDepth, index});
    }
  });
  if (matched.length === 0) {
    return null;
  }
  // Strongest first: higher rank, then deeper path, then later declaration
  // (a later, equally specific template is treated as the more intentional one).
  matched.sort(
      (a, b) => b.rank - a.rank || b.pathDepth - a.pathDepth || b.index - a.index,
  );
  return matched[0].template;
}

function mergeFrontmatter(
    base: Record<string, TemplateFrontmatterValue> | undefined,
    over: Record<string, TemplateFrontmatterValue> | undefined,
): Record<string, TemplateFrontmatterValue> {
  return {...(base ?? {}), ...(over ?? {})};
}

/** Merge the global base with one (optional) scoped template and apply toggles. */
function mergeResolved(global: GlobalTemplate, scoped: ScopedTemplate | null): ResolvedTemplate {
  let frontmatter = mergeFrontmatter(global.frontmatter, scoped?.frontmatter);
  let pinnedKeys = [...(scoped?.['pinned-keys'] ?? global['pinned-keys'] ?? [])];
  const keyOrder = [...(scoped?.['key-order'] ?? global['key-order'] ?? [])];
  const body = scoped?.body ?? global.body ?? '';
  const ageLine = scoped?.['age-line'] ?? global['age-line'] ?? false;

  // Toggles switch inherited attributes off (or explicitly on) for this scope.
  const toggles = scoped?.toggles ?? {};
  for (const [key, state] of Object.entries(toggles)) {
    if (toggledOff(state)) {
      const {[key]: _dropped, ...rest} = frontmatter;
      frontmatter = rest;
      pinnedKeys = pinnedKeys.filter((k) => k !== key);
    }
  }

  return {
    name: scoped?.name ?? null,
    chain: scoped ? ['global', scoped.name] : ['global'],
    frontmatter,
    pinnedKeys,
    keyOrder,
    body,
    ageLine,
  };
}

/**
 * Resolve the effective template for one file: the global base, refined by the
 * one scoped template whose match applies, with toggles removing any inherited
 * attribute switched off for that scope. Returns null when there is no
 * `templates` block and no global base at all.
 */
export function resolveTemplate(
    facts: FileFacts,
    config: LinterConfig,
): ResolvedTemplate | null {
  const templates: TemplatesConfig | undefined = config.templates;
  if (!templates || (!templates.global && !(templates['by-scope']?.length))) {
    return null;
  }
  const global: GlobalTemplate = templates.global ?? {};
  const scoped = selectScoped(templates['by-scope'] ?? [], facts);
  return mergeResolved(global, scoped);
}

/**
 * Resolve a template by name for display, independent of any file: 'global'
 * (or undefined) yields the base alone; any other name yields that scoped
 * template merged over the base. Returns null when the name is unknown or no
 * templates are configured. Powers `template show` and the plugin editor.
 */
export function resolveNamedTemplate(
    config: LinterConfig,
    name?: string,
): ResolvedTemplate | null {
  const templates: TemplatesConfig | undefined = config.templates;
  if (!templates || (!templates.global && !(templates['by-scope']?.length))) {
    return null;
  }
  const global: GlobalTemplate = templates.global ?? {};
  if (name === undefined || name === 'global') {
    return mergeResolved(global, null);
  }
  const scoped = (templates['by-scope'] ?? []).find((t) => t.name === name);
  if (!scoped) {
    return null;
  }
  return mergeResolved(global, scoped);
}
