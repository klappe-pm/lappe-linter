/**
 * Pure model for the scope builder: the catalog of scope types and the
 * translation from a set of user selections into a linter.yaml `match` block.
 * Kept Obsidian-free so the mapping is unit-tested; the UI only collects
 * values and renders the fields this describes.
 */

export type ScopeFieldKind = 'multi' | 'range';

export interface ScopeType {
  /** Stable key used as the selection id. */
  key: string;
  /** Human label shown in the picker. */
  label: string;
  /** Whether the field collects a list of values or a date range. */
  kind: ScopeFieldKind;
}

// Preset frontmatter keys get their own scope types so users pick "Domain"
// rather than typing a property name. `project` is a preset under types.
export const SCOPE_TYPES: ScopeType[] = [
  {key: 'folder', label: 'Folder', kind: 'multi'},
  {key: 'file', label: 'File', kind: 'multi'},
  {key: 'path', label: 'File path (glob)', kind: 'multi'},
  {key: 'extension', label: 'Extension', kind: 'multi'},
  {key: 'properties', label: 'Properties (key=value)', kind: 'multi'},
  {key: 'tag', label: 'Tag', kind: 'multi'},
  {key: 'backlink', label: 'Backlink', kind: 'multi'},
  {key: 'alias', label: 'Alias', kind: 'multi'},
  {key: 'domain', label: 'Domain', kind: 'multi'},
  {key: 'category', label: 'Category', kind: 'multi'},
  {key: 'sub-category', label: 'Sub-category', kind: 'multi'},
  {key: 'types', label: 'Types', kind: 'multi'},
  {key: 'project', label: 'Project', kind: 'multi'},
  {key: 'age', label: 'Age bucket (e.g. 1-5)', kind: 'multi'},
  {key: 'date-created', label: 'Date created (range)', kind: 'range'},
  {key: 'date-revised', label: 'Date revised (range)', kind: 'range'},
];

export interface ScopeSelection {
  type: string;
  /** Values for a 'multi' field. */
  values?: string[];
  /** Bounds for a 'range' field. */
  range?: {after?: string; before?: string};
}

const PRESET_FRONTMATTER_KEYS = new Set(['domain', 'category', 'sub-category', 'types', 'project']);

/**
 * Build a linter.yaml `match` object from selections. Path/file/folder map to
 * globs (a folder becomes `folder/**`); preset keys and free properties map to
 * frontmatter predicates; tag/backlink/alias/age map to their own kinds; date
 * scopes map to inclusive ranges. Empty selections are skipped.
 */
export function buildMatch(selections: ScopeSelection[]): Record<string, unknown> {
  const match: Record<string, unknown> = {};
  const pushList = (key: string, values: string[]) => {
    const existing = (match[key] as string[] | undefined) ?? [];
    match[key] = [...existing, ...values];
  };

  for (const selection of selections) {
    const values = (selection.values ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
    switch (selection.type) {
      case 'folder':
        pushList('path', values.map((v) => `${v.replace(/\/+$/, '')}/**`));
        break;
      case 'file':
      case 'path':
        pushList('path', values);
        break;
      case 'extension':
        pushList('extension', values.map((v) => v.replace(/^\./, '')));
        break;
      case 'tag':
        pushList('tag', values);
        break;
      case 'backlink':
        pushList('backlink', values);
        break;
      case 'alias':
        pushList('alias', values);
        break;
      case 'age':
        pushList('age', values);
        break;
      case 'property':
      case 'properties': {
        const fm = (match.frontmatter as Record<string, unknown>) ?? {};
        for (const pair of values) {
          const eq = pair.indexOf('=');
          if (eq > 0) {
            fm[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
          }
        }
        if (Object.keys(fm).length > 0) {
          match.frontmatter = fm;
        }
        break;
      }
      case 'date-created':
      case 'date-revised':
        if (selection.range && (selection.range.after || selection.range.before)) {
          match[selection.type] = {...selection.range};
        }
        break;
      default:
        if (PRESET_FRONTMATTER_KEYS.has(selection.type) && values.length > 0) {
          const fm = (match.frontmatter as Record<string, unknown>) ?? {};
          fm[selection.type] = values.length === 1 ? values[0] : values;
          match.frontmatter = fm;
        }
    }
  }
  return match;
}
