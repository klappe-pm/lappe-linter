import {TemplateFrontmatterValue} from '../config/types';
import {formatEntryLines, FlatScalar} from '../note-types/frontmatter';
import {compareRank, rankKey} from '../note-types/key-rank';
import {ageBucket} from '../scope/advanced-matchers';
import {RenderTemplateOptions, ResolvedTemplate} from './types';

function substituteTitle(value: string, title: string): string {
  return value.split('{{title}}').join(title);
}

function applyTitleToValue(value: TemplateFrontmatterValue, title: string): TemplateFrontmatterValue {
  if (typeof value === 'string') {
    return substituteTitle(value, title);
  }
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? substituteTitle(item, title) : item));
  }
  return value;
}

/**
 * Render a resolved template into note text. Pure: with no `today` supplied it
 * never fills dates or emits an age line, so output is deterministic and the
 * core stays clock-free. Frontmatter keys are ordered by the template's
 * key-order (falling back to the house ranking) and serialized in house style.
 */
export function renderTemplate(
    resolved: ResolvedTemplate,
    options: RenderTemplateOptions = {},
): string {
  const title = options.title ?? '';
  const createdKey = options.dateCreatedKey ?? 'date-created';
  const revisedKey = options.dateRevisedKey ?? 'date-revised';

  const frontmatter: Record<string, TemplateFrontmatterValue> = {};
  for (const [key, raw] of Object.entries(resolved.frontmatter)) {
    frontmatter[key] = applyTitleToValue(raw, title);
  }

  // Fill null-valued date keys from the caller-supplied `today` only; a value
  // the template already set is never overwritten.
  if (options.today) {
    if (createdKey in frontmatter && frontmatter[createdKey] === null) {
      frontmatter[createdKey] = options.today;
    }
    if (revisedKey in frontmatter && frontmatter[revisedKey] === null) {
      frontmatter[revisedKey] = options.today;
    }
  }

  const orderedKeys = Object.keys(frontmatter).sort((a, b) =>
    compareRank(rankKey(a, resolved.keyOrder), rankKey(b, resolved.keyOrder)),
  );

  const lines: string[] = [];
  if (orderedKeys.length > 0) {
    lines.push('---');
    for (const key of orderedKeys) {
      lines.push(...formatEntryLines(key, frontmatter[key] as FlatScalar | FlatScalar[] | null));
    }
    lines.push('---');
    lines.push('');
  }

  const body = substituteTitle(resolved.body, title).trim();
  if (body) {
    lines.push(body);
  }

  const created = frontmatter[createdKey];
  if (resolved.ageLine && options.today && typeof created === 'string') {
    const bucket = ageBucket(created, options.today);
    if (bucket !== null) {
      lines.push('');
      lines.push(`> age: ${bucket}`);
    }
  }

  return lines.join('\n') + '\n';
}
