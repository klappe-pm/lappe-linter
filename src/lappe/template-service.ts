import {App, moment, Notice, TFile} from 'obsidian';
import {
  FileFacts,
  LinterConfig,
  ResolvedTemplate,
  renderTemplate,
  resolveNamedTemplate,
  resolveTemplate,
} from '@lappe-linter/core';
import type LinterPlugin from '../main';
import {logInfo, logWarn} from '../utils/logger';

/**
 * Plugin-side surface for the property-based template subsystem (F-templates).
 * The core owns resolution and rendering; this bridge builds `FileFacts` from
 * vault files, honors the DEC-104 apply contract (never overwrite an existing
 * note's values or body; only scaffold new notes or add missing pinned keys),
 * and exposes both to commands and the preview view.
 *
 * The pure helpers below carry no Obsidian dependency so the DEC-104 safety
 * behavior is unit-tested directly, matching the CLI `template apply` path.
 */

/** Extract the raw frontmatter YAML text (no fences) for scope matching, or null. */
export function extractRawFrontmatter(text: string): string | null {
  const lines = text.split('\n');
  if (lines[0] !== '---') {
    return null;
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      return lines.slice(1, i).join('\n');
    }
  }
  return null;
}

/** Shallow top-level frontmatter keys, for pinned-key conformance checks. */
export function frontmatterKeys(raw: string | null): Set<string> {
  const keys = new Set<string>();
  if (raw === null) {
    return keys;
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^([\w-]+):/);
    if (m) {
      keys.add(m[1]);
    }
  }
  return keys;
}

function scalarYaml(value: string | number | boolean): string {
  const s = String(value);
  return s === '' || /[:#[\]{},"']|^\s|\s$/.test(s) ? JSON.stringify(s) : s;
}

function serializeKeyLines(key: string, value: unknown): string[] {
  if (value === null || value === undefined) {
    return [`${key}:`];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${key}:`];
    }
    return [`${key}:`, ...value.map((item) => `  - ${scalarYaml(item as string | number | boolean)}`)];
  }
  return [`${key}: ${scalarYaml(value as string | number | boolean)}`];
}

/**
 * DEC-104: add the template-owned pinned keys missing from an existing note's
 * frontmatter, preserving every other key, every value already set, and the
 * body. Pure and identical in behavior to the CLI's `enforcePinnedKeys` so the
 * plugin and CLI never diverge on what "apply to an existing note" means.
 */
export function enforcePinnedKeys(
    text: string,
    pinnedKeys: string[],
    frontmatter: Record<string, unknown>,
): {text: string; added: string[]} {
  const present = frontmatterKeys(extractRawFrontmatter(text));
  const missing = pinnedKeys.filter((k) => !present.has(k) && k in frontmatter);
  if (missing.length === 0) {
    return {text, added: []};
  }
  const newLines = missing.flatMap((k) => serializeKeyLines(k, frontmatter[k]));
  const lines = text.split('\n');
  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        lines.splice(i, 0, ...newLines);
        return {text: lines.join('\n'), added: missing};
      }
    }
  }
  // No frontmatter: prepend a fresh block, keeping the original body intact.
  return {text: `${['---', ...newLines, '---', ''].join('\n')}${text}`, added: missing};
}

/** The note stem (filename without .md) used as the {{title}} substitution. */
export function stemOf(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.md$/, '');
}

export class LappeTemplateService {
  constructor(private app: App, private plugin: LinterPlugin) {}

  private get config(): LinterConfig | null {
    return this.plugin.lappeConfig?.config ?? null;
  }

  private today(): string {
    return moment().format('YYYY-MM-DD');
  }

  /** True when the resolved config declares any template (global or scoped). */
  hasTemplates(): boolean {
    const templates = this.config?.templates;
    return templates != null && (templates.global != null || (templates['by-scope']?.length ?? 0) > 0);
  }

  /** Scoped template names available for explicit selection in the preview. */
  scopedNames(): string[] {
    return (this.config?.templates?.['by-scope'] ?? []).map((t) => t.name);
  }

  private factsFor(path: string, existingText: string | null): FileFacts {
    return {
      path,
      frontmatter: existingText != null ? extractRawFrontmatter(existingText) : null,
      today: this.today(),
    };
  }

  /** Resolve the template that applies to a vault path (scope-matched). */
  resolveForPath(path: string, existingText: string | null): ResolvedTemplate | null {
    const config = this.config;
    if (config == null) {
      return null;
    }
    return resolveTemplate(this.factsFor(path, existingText), config);
  }

  /** Resolve a named template for display: undefined/'global' = base alone. */
  resolveNamed(name?: string): ResolvedTemplate | null {
    const config = this.config;
    if (config == null) {
      return null;
    }
    return resolveNamedTemplate(config, name);
  }

  /** Render a resolved template to note text, with a title and today filled in. */
  render(resolved: ResolvedTemplate, title: string): string {
    return renderTemplate(resolved, {title, today: this.today()});
  }

  /**
   * Scaffold a NEW note from the template that matches `path` and open it.
   * DEC-104: refuses to touch a path that already exists (no silent overwrite);
   * the caller should route existing notes through `applyToExisting` instead.
   */
  async createNote(path: string): Promise<TFile | null> {
    const config = this.config;
    if (config == null) {
      new Notice('lappe-linter: linter.yaml is invalid; templates unavailable.');
      return null;
    }
    const normalized = path.endsWith('.md') ? path : `${path}.md`;
    if (this.app.vault.getAbstractFileByPath(normalized) != null) {
      new Notice(`lappe-linter: ${normalized} already exists; not overwritten.`);
      return null;
    }
    const resolved = resolveTemplate(this.factsFor(normalized, null), config);
    if (resolved == null) {
      new Notice(`lappe-linter: no template matches ${normalized}.`);
      return null;
    }
    const rendered = this.render(resolved, stemOf(normalized));
    const parent = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
    if (parent && this.app.vault.getFolderByPath(parent) == null) {
      await this.app.vault.createFolder(parent);
    }
    const file = await this.app.vault.create(normalized, rendered);
    logInfo(`lappe-linter: scaffolded ${normalized} from template ${resolved.name ?? 'global'}`);
    new Notice(`lappe-linter: created ${normalized} from template ${resolved.name ?? 'global'}.`);
    return file;
  }

  /**
   * Apply the matching template's pinned keys to an EXISTING note in place
   * (DEC-104 enforce): adds only missing template-owned keys, never overwriting
   * a value the author already set and never touching the body. Returns the
   * keys added, or null when no template matched.
   */
  async applyToExisting(file: TFile): Promise<string[] | null> {
    const config = this.config;
    if (config == null) {
      new Notice('lappe-linter: linter.yaml is invalid; templates unavailable.');
      return null;
    }
    const text = await this.app.vault.read(file);
    const resolved = resolveTemplate(this.factsFor(file.path, text), config);
    if (resolved == null) {
      new Notice(`lappe-linter: no template matches ${file.path}.`);
      return null;
    }
    const enforced = enforcePinnedKeys(text, resolved.pinnedKeys, resolved.frontmatter);
    if (enforced.added.length === 0) {
      new Notice(`lappe-linter: ${file.path} already conforms to template ${resolved.name ?? 'global'}.`);
      return [];
    }
    await this.app.vault.modify(file, enforced.text);
    logWarn(`lappe-linter: enforced ${file.path}: added pinned keys ${enforced.added.join(', ')}`);
    new Notice(`lappe-linter: added ${enforced.added.length} pinned key${enforced.added.length === 1 ? '' : 's'} to ${file.path}.`);
    return enforced.added;
  }
}
