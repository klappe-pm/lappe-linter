import {AbstractInputSuggest, App} from 'obsidian';

/** Every frontmatter key in the vault, alphabetical, deduped. */
export function vaultYamlKeys(app: App): string[] {
  const keys = new Set<string>();
  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontmatter) {
      for (const key of Object.keys(frontmatter)) {
        if (key !== 'position') {
          keys.add(key);
        }
      }
    }
  }
  return [...keys].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/** Every scalar value seen in the vault for one frontmatter key, alphabetical. */
export function vaultYamlValues(app: App, key: string): string[] {
  const values = new Set<string>();
  for (const file of app.vault.getMarkdownFiles()) {
    const value = app.metadataCache.getFileCache(file)?.frontmatter?.[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      values.add(String(value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
          values.add(String(item));
        }
      }
    }
  }
  return [...values].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/**
 * Autocomplete over a caller-supplied candidate list: focusing the input shows
 * the full list, typing filters it, selecting fills the input. New entries not
 * in the list are always allowed; commit happens on Enter in the input itself.
 */
export class ListSuggest extends AbstractInputSuggest<string> {
  // Candidates can rescan the whole vault (vaultYamlKeys/vaultYamlValues), so
  // cache them for the lifetime of one popover open instead of recomputing on
  // every keystroke; close() drops the cache so the next focus refreshes.
  private cached: string[] | null = null;

  constructor(
      app: App,
    private input: HTMLInputElement,
    private candidates: () => string[],
    private onPick?: (value: string) => void,
  ) {
    super(app, input);
  }

  protected getSuggestions(inputStr: string): string[] {
    const lower = inputStr.toLowerCase();
    this.cached ??= this.candidates();
    return this.cached.filter((value) => value.toLowerCase().contains(lower));
  }

  close(): void {
    this.cached = null;
    super.close();
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(value);
  }

  selectSuggestion(value: string): void {
    this.setValue(value);
    this.input.trigger('input');
    this.close();
    if (this.onPick) {
      this.onPick(value);
    }
  }
}
