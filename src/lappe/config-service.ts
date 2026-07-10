import {App, Notice, TAbstractFile, TFile} from 'obsidian';
import type {Document} from 'yaml';
import {
  BUILTIN_CODE_CHECKS,
  CANONICAL_CONFIG_FILENAME,
  CONFIG_FILENAME_ALIASES,
  LinterConfig,
  STYLES_FOLDER,
  StyleFile,
  defaultLinterConfig,
  mergeStyleFiles,
  parseLinterConfig,
  scaffoldConfig,
  updateConfigText,
} from '@lappe-linter/core';
import LinterPlugin from '../main';
import {logInfo, logWarn} from '../utils/logger';

/**
 * Plugin-side owner of linter.yaml (F01). Loads the vault-root config through
 * the core loader, fails closed on validation errors (core linting disables
 * with one Notice), reloads on external modification (e.g. git pull), and
 * writes UI edits back through the comment-preserving core serializer.
 */
export class LappeConfigService {
  private current: LinterConfig | null = null;
  private configPath: string | null = null;
  private lastErrorNotice = '';
  private styleNames: string[] = [];
  private styleErrors: Array<{name: string; message: string}> = [];
  // Serializes ignore-list writes: rapid checkbox toggles queue up instead of
  // racing read-modify-write cycles that would drop each other's edits.
  private ignoreWriteChain: Promise<void> = Promise.resolve();

  constructor(private app: App) {}

  get config(): LinterConfig | null {
    return this.current;
  }

  get path(): string | null {
    return this.configPath;
  }

  /** True when the file exists but failed validation (fail-closed state). */
  get failedClosed(): boolean {
    return this.configPath != null && this.current == null;
  }

  /** Style files found in linter-styles/, by profile name. */
  get styles(): string[] {
    return [...this.styleNames];
  }

  get stylesFolder(): string {
    return STYLES_FOLDER;
  }

  async load(): Promise<void> {
    this.configPath = null;
    this.current = null;

    for (const name of CONFIG_FILENAME_ALIASES) {
      const file = this.app.vault.getAbstractFileByPath(name);
      if (file instanceof TFile) {
        this.configPath = name;
        break;
      }
    }

    let base: LinterConfig | null = null;
    if (this.configPath == null) {
      // Mandatory defaults (dec-005) run even with no linter.yaml present.
      base = defaultLinterConfig();
      logInfo('lappe-linter: no linter.yaml at the vault root; compiled defaults active');
    } else {
      const text = await this.app.vault.adapter.read(this.configPath);
      const result = parseLinterConfig(text);
      if (result.ok) {
        base = result.config;
        this.lastErrorNotice = '';
        for (const warning of result.warnings) {
          logWarn(`lappe-linter: ${warning}`);
        }
        logInfo(`lappe-linter: loaded ${this.configPath}`);
      } else {
        // Fail closed: one Notice, no partial apply (F01 R1).
        const summary = result.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
        if (summary !== this.lastErrorNotice) {
          this.lastErrorNotice = summary;
          new Notice(`lappe-linter: ${this.configPath} is invalid; scoped linting disabled.\n${summary}`, 10000);
        }
        logWarn(`lappe-linter: invalid config, linting disabled:\n${summary}`);
        return;
      }
    }

    this.current = await this.mergeStyles(base);
  }

  /** Read linter-styles/*.yaml and merge each file as a named profile. */
  private async mergeStyles(base: LinterConfig): Promise<LinterConfig> {
    this.styleNames = [];
    this.styleErrors = [];
    const folder = this.app.vault.getFolderByPath(STYLES_FOLDER);
    if (folder == null) {
      return base;
    }
    const styleFiles: StyleFile[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && (child.extension === 'yaml' || child.extension === 'yml')) {
        styleFiles.push({name: child.basename, text: await this.app.vault.adapter.read(child.path)});
      }
    }
    if (styleFiles.length === 0) {
      return base;
    }
    const merged = mergeStyleFiles(base, styleFiles);
    this.styleNames = styleFiles.map((style) => style.name).sort();
    this.styleErrors = merged.errors.map((error) => ({
      name: error.name,
      message: error.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
    }));
    for (const error of this.styleErrors) {
      logWarn(`lappe-linter: style "${error.name}" skipped: ${error.message}`);
    }
    return merged.config;
  }

  /** Reload when the config file or a style file changes on disk. */
  register(plugin: LinterPlugin): void {
    const relevant = (file: TAbstractFile) =>
      CONFIG_FILENAME_ALIASES.includes(file.path) || file.path.startsWith(`${STYLES_FOLDER}/`);
    plugin.registerEvent(this.app.vault.on('modify', (file) => {
      if (relevant(file)) {
        void this.load();
      }
    }));
    plugin.registerEvent(this.app.vault.on('create', (file) => {
      if (relevant(file)) {
        void this.load();
      }
    }));
    plugin.registerEvent(this.app.vault.on('delete', (file) => {
      if (relevant(file)) {
        void this.load();
      }
    }));
    plugin.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (relevant(file) || CONFIG_FILENAME_ALIASES.includes(oldPath) || oldPath.startsWith(`${STYLES_FOLDER}/`)) {
        void this.load();
      }
    }));
  }

  /** Create a named style file in linter-styles/ and return its path. */
  async createStyle(name: string): Promise<string> {
    if (this.app.vault.getFolderByPath(STYLES_FOLDER) == null) {
      await this.app.vault.createFolder(STYLES_FOLDER);
    }
    const path = `${STYLES_FOLDER}/${name}.yaml`;
    if (this.app.vault.getAbstractFileByPath(path) == null) {
      const template = [
        '# lappe-linter style file: one profile fragment, merged by filename.',
        '# match binds this style to folders, tags, properties, or extensions;',
        '# rules override the defaults for everything it matches.',
        'match:',
        '  path:',
        `    - some-folder/**`,
        'rules: {}',
        '',
      ].join('\n');
      await this.app.vault.create(path, template);
    }
    await this.load();
    return path;
  }

  /** Create a commented starter linter.yaml at the vault root when absent. */
  async ensureConfigFile(): Promise<string> {
    if (this.configPath != null) {
      return this.configPath;
    }
    await this.app.vault.create(CANONICAL_CONFIG_FILENAME, scaffoldConfig());
    await this.load();
    new Notice(`lappe-linter: created ${CANONICAL_CONFIG_FILENAME} at the vault root`);
    return CANONICAL_CONFIG_FILENAME;
  }

  /**
   * Read-modify-write of linter.yaml through the comment-preserving core
   * serializer. Re-reads immediately before the write and re-applies the
   * mutation when the file changed underneath (git pull, sync, hand edit in
   * another editor), so a concurrent external edit is not silently clobbered
   * by a stale UI write.
   */
  private async writeConfigUpdate(mutate: (doc: Document) => void): Promise<void> {
    const path = await this.ensureConfigFile();
    const text = await this.app.vault.adapter.read(path);
    let updated = updateConfigText(text, mutate);
    const latest = await this.app.vault.adapter.read(path);
    if (latest !== text) {
      logWarn(`lappe-linter: ${path} changed on disk during a settings edit; re-applying the edit to the fresh content`);
      updated = updateConfigText(latest, mutate);
    }
    await this.app.vault.adapter.write(path, updated);
    await this.load();
  }

  /**
   * Toggle a rule under defaults.rules in linter.yaml, preserving comments and
   * unknown keys. The file is the source of truth; the in-memory config
   * refreshes from the written text.
   */
  async setDefaultRuleEnabled(ruleId: string, enabled: boolean): Promise<void> {
    await this.writeConfigUpdate((doc) => {
      doc.setIn(['defaults', 'rules', ruleId, 'enabled'], enabled);
    });
  }

  /**
   * Write the combined YAML key sort control back to linter.yaml: the ordered
   * key list plus optional per-key default values, comment-preserving.
   */
  async updateYamlKeySort(orderedKeys: string[], defaults: Record<string, string>): Promise<void> {
    await this.writeConfigUpdate((doc) => {
      doc.setIn(['defaults', 'rules', 'yaml-key-sort', 'enabled'], true);
      doc.setIn(['defaults', 'rules', 'yaml-key-sort', 'priority-keys'], orderedKeys);
      if (Object.keys(defaults).length === 0) {
        doc.deleteIn(['defaults', 'rules', 'yaml-key-sort', 'defaults']);
      } else {
        doc.setIn(['defaults', 'rules', 'yaml-key-sort', 'defaults'], defaults);
      }
    });
  }

  /**
   * Toggle one declarative code check (dec-006) in the linter.yaml
   * code-checks section. Built-ins gain a stanza on first toggle.
   */
  async setCodeCheckEnabled(checkId: string, enabled: boolean): Promise<void> {
    await this.writeConfigUpdate((doc) => {
      doc.setIn(['code-checks', checkId, 'enabled'], enabled);
    });
  }

  /** Effective code checks: built-ins merged under config, for the tab UI. */
  codeCheckState(): Array<{id: string; description: string; enabled: boolean; builtin: boolean}> {
    const configured = this.current?.['code-checks'] ?? {};
    const merged: Record<string, {description?: string; enabled?: boolean}> = {};
    for (const [id, check] of Object.entries(BUILTIN_CODE_CHECKS)) {
      merged[id] = {...check};
    }
    for (const [id, check] of Object.entries(configured)) {
      merged[id] = {...merged[id], ...check};
    }
    return Object.entries(merged).map(([id, check]) => ({
      id,
      description: check.description ?? '',
      enabled: check.enabled === true,
      builtin: id in BUILTIN_CODE_CHECKS,
    })).sort((a, b) => a.id.localeCompare(b.id));
  }

  /** The current combined sort control state read from the config. */
  yamlKeySortState(): {keys: string[]; defaults: Record<string, string>} {
    const stanza = this.current?.defaults?.rules?.['yaml-key-sort'] ?? {};
    const keys = Array.isArray(stanza['priority-keys'])
      ? (stanza['priority-keys'] as unknown[]).filter((k): k is string => typeof k === 'string')
      : [];
    const rawDefaults = stanza['defaults'];
    const defaults: Record<string, string> = {};
    if (rawDefaults && typeof rawDefaults === 'object' && !Array.isArray(rawDefaults)) {
      for (const [key, value] of Object.entries(rawDefaults as Record<string, unknown>)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          defaults[key] = String(value);
        }
      }
    }
    return {keys, defaults};
  }

  /** Folder paths currently excluded via ignore.folders, trailing slash stripped. */
  ignoredFolders(): string[] {
    return (this.current?.ignore?.folders ?? []).map((folder) => folder.replace(/\/+$/, ''));
  }

  /**
   * Add or remove one folder path in ignore.folders, comment-preserving.
   * Exactly one file write per call; concurrent calls run in sequence.
   */
  async setIgnoredFolder(path: string, ignored: boolean): Promise<void> {
    const normalized = path.replace(/\/+$/, '');
    const run = this.ignoreWriteChain.then(() => this.writeConfigUpdate((doc) => {
      const node = doc.getIn(['ignore', 'folders']);
      const raw = node != null && typeof (node as {toJSON?: () => unknown}).toJSON === 'function' ?
        (node as {toJSON: () => unknown}).toJSON() : [];
      const folders = (Array.isArray(raw) ? raw : [])
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.replace(/\/+$/, ''));
      const next = folders.filter((folder) => folder !== normalized);
      if (ignored) {
        next.push(normalized);
      }
      doc.setIn(['ignore', 'folders'], next);
    }));
    // Keep the chain alive after a failed write so later toggles still land.
    this.ignoreWriteChain = run.catch(() => undefined);
    return run;
  }

  /** True when the path is excluded by the config's ignore section. */
  isIgnored(path: string): boolean {
    const ignore = this.current?.ignore;
    if (ignore == null) {
      return false;
    }
    if ((ignore.files ?? []).includes(path)) {
      return true;
    }
    for (const folder of ignore.folders ?? []) {
      const prefix = folder.endsWith('/') ? folder : `${folder}/`;
      if (path.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }
}
