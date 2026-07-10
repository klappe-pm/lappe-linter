import {App, Notice, Setting} from 'obsidian';
import {getRules, registerAllRules} from '@lappe-linter/core';
import LinterPlugin from '../../../main';
import {Tab} from './tab';
import {ListSuggest, vaultYamlKeys, vaultYamlValues} from '../../../lappe/yaml-suggest';

/**
 * The Lappe settings tab: a view over linter.yaml (the source of truth).
 * One combined YAML key sort control, toggles for the core rules, and a
 * read-only summary of the scoped profiles and note types.
 */
export class LappeTab extends Tab {
  constructor(navEl: HTMLElement, settingsEl: HTMLElement, isMobile: boolean, plugin: LinterPlugin, private app: App) {
    super(navEl, settingsEl, 'Lappe', isMobile, plugin);
    this.display();
  }

  display(): void {
    this.contentEl.empty();
    registerAllRules();
    const service = this.plugin.lappeConfig;

    // Config status header.
    const statusDiv = this.contentEl.createDiv();
    if (service.failedClosed) {
      new Setting(statusDiv)
          .setName('linter.yaml is invalid')
          .setDesc('Scoped linting is disabled until the file parses. Fix it in your editor; this tab reloads automatically.');
      return;
    }
    if (service.path == null) {
      new Setting(statusDiv)
          .setName('linter.yaml')
          .setDesc('Running on compiled defaults (key order, timestamps, kebab-case, and H1 matching are on). Create linter.yaml to make your preferences git-tracked; edits below create it automatically.')
          .addButton((button) => button.setButtonText('Create linter.yaml').setCta().onClick(async () => {
            await service.ensureConfigFile();
            this.display();
          }));
    } else {
      new Setting(statusDiv)
          .setName('linter.yaml')
          .setDesc(`Loaded from ${service.path}. Edits here write back to that file, preserving comments.`)
          .setHeading();
    }

    this.displayKeySortSection();
    this.displayRuleToggles();
    this.displayStylesSection();
    this.displayScopesSummary();
  }

  /**
   * The one combined control: "this is the order YAML keys get sorted in".
   * A visible ordered list with an autocomplete key input (all vault keys,
   * Enter adds) and a same-pattern optional default-value input beside it.
   */
  private displayKeySortSection(): void {
    const service = this.plugin.lappeConfig;
    const state = service.yamlKeySortState();

    const section = this.contentEl.createDiv({cls: 'lappe-key-sort'});
    new Setting(section)
        .setName('YAML key sort order')
        .setDesc('This is the order YAML keys get sorted in. Keys not listed sort alphabetically after these, with aliases and tags last. A default value next to a key is inserted when that key is missing; existing values are never changed.')
        .setHeading();

    const listEl = section.createDiv({cls: 'lappe-key-sort-list'});
    listEl.style.border = '1px solid var(--background-modifier-border)';
    listEl.style.borderRadius = '8px';
    listEl.style.padding = '8px';
    listEl.style.marginBottom = '8px';
    listEl.style.maxHeight = '340px';
    listEl.style.overflowY = 'auto';

    const persist = async (keys: string[], defaults: Record<string, string>) => {
      await service.updateYamlKeySort(keys, defaults);
      this.display();
    };

    if (state.keys.length === 0) {
      listEl.createEl('div', {text: 'No keys yet. Add the first one below.'}).style.color = 'var(--text-muted)';
    }
    state.keys.forEach((key, index) => {
      const row = new Setting(listEl).setName(`${index + 1}. ${key}`);
      const defaultValue = state.defaults[key];
      if (defaultValue !== undefined) {
        row.setDesc(`default when missing: ${defaultValue}`);
      }
      row.addExtraButton((b) => b.setIcon('chevron-up').setTooltip('Move up').setDisabled(index === 0).onClick(() => {
        const keys = [...state.keys];
        [keys[index - 1], keys[index]] = [keys[index], keys[index - 1]];
        void persist(keys, state.defaults);
      }));
      row.addExtraButton((b) => b.setIcon('chevron-down').setTooltip('Move down').setDisabled(index === state.keys.length - 1).onClick(() => {
        const keys = [...state.keys];
        [keys[index], keys[index + 1]] = [keys[index + 1], keys[index]];
        void persist(keys, state.defaults);
      }));
      row.addExtraButton((b) => b.setIcon('x').setTooltip('Remove').onClick(() => {
        const keys = state.keys.filter((k) => k !== key);
        const defaults = {...state.defaults};
        delete defaults[key];
        void persist(keys, defaults);
      }));
    });

    // Add row: key + optional default value, both autocomplete, Enter adds.
    const addRow = section.createDiv({cls: 'lappe-key-sort-add'});
    addRow.style.display = 'flex';
    addRow.style.gap = '8px';
    addRow.style.alignItems = 'center';

    const keyInput = addRow.createEl('input', {type: 'text', placeholder: 'key (click for all vault keys)'});
    keyInput.style.flex = '2';
    const valueInput = addRow.createEl('input', {type: 'text', placeholder: 'default value (optional)'});
    valueInput.style.flex = '2';

    new ListSuggest(this.app, keyInput, () => vaultYamlKeys(this.app).filter((k) => !state.keys.includes(k)));
    new ListSuggest(this.app, valueInput, () => keyInput.value.trim() === '' ? [] : vaultYamlValues(this.app, keyInput.value.trim()));

    const commit = () => {
      const key = keyInput.value.trim();
      if (key === '') {
        return;
      }
      if (state.keys.includes(key)) {
        new Notice(`lappe-linter: "${key}" is already in the list`);
        return;
      }
      const defaults = {...state.defaults};
      const value = valueInput.value.trim();
      if (value !== '') {
        defaults[key] = value;
      }
      void persist([...state.keys, key], defaults);
    };

    for (const input of [keyInput, valueInput]) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
      });
    }
    const addButton = addRow.createEl('button', {text: 'Add'});
    addButton.addEventListener('click', commit);

    // dec-005: the two YAML behaviors that ride along with key order.
    const stanza = service.config?.defaults?.rules?.['alphabetize-property-values'];
    new Setting(section.createDiv())
        .setName('Alphabetize property values')
        .setDesc('Sort the values on lines (aliases, tags, links, any list); never the keys, whose order is set above.')
        .addToggle((toggle) => toggle.setValue(stanza?.enabled !== false).onChange(async (value) => {
          await service.setDefaultRuleEnabled('alphabetize-property-values', value);
        }));
    new Setting(section.createDiv())
        .setName('Timestamps')
        .setDesc('date-created and date-revised are managed automatically (yyyy-MM-dd, time HHmm): created is set on first lint, revised bumps only when content actually changed. This is always on.');
  }

  /** Enable/disable toggles for every registered core rule. */
  private displayRuleToggles(): void {
    const service = this.plugin.lappeConfig;
    const config = service.config;

    new Setting(this.contentEl).setName('Rules').setDesc('Core rules run on save and via the lappe-linter CLI, scoped by the profiles below. yaml-key-sort is managed by the sort order control above.').setHeading();

    const managedElsewhere = new Set(['yaml-key-sort', 'yaml-timestamp', 'alphabetize-property-values']);
    const rules = getRules().filter((rule) => !managedElsewhere.has(rule.id) && !rule.id.startsWith('note-type-'));
    for (const rule of rules) {
      const stanza = config?.defaults?.rules?.[rule.id];
      new Setting(this.contentEl.createDiv())
          .setName(rule.id)
          .setDesc(rule.description)
          .addToggle((toggle) => toggle.setValue(stanza?.enabled === true).onChange(async (value) => {
            await service.setDefaultRuleEnabled(rule.id, value);
          }));
    }
  }

  /**
   * Style files (dec-005): named profile fragments in linter-styles/ next to
   * linter.yaml, each carrying its own folder/tag/property bindings. This is
   * where per-folder definitions live; linter.yaml wins name conflicts.
   */
  private displayStylesSection(): void {
    const service = this.plugin.lappeConfig;
    new Setting(this.contentEl)
        .setName('Styles')
        .setDesc(`Style files in ${service.stylesFolder}/ apply automatically as profiles. Each file binds itself to folders, tags, or properties via its match block and overrides rules for what it matches.`)
        .setHeading()
        .addButton((button) => button.setButtonText('New style').onClick(async () => {
          const name = `style-${service.styles.length + 1}`;
          const path = await service.createStyle(name);
          await this.app.workspace.openLinkText(path, '', true);
          this.display();
        }));

    if (service.styles.length === 0) {
      this.contentEl.createEl('div', {text: `No style files yet; create one to start a ${service.stylesFolder}/ folder.`}).style.color = 'var(--text-muted)';
    }
    for (const name of service.styles) {
      new Setting(this.contentEl.createDiv())
          .setName(name)
          .setDesc(`${service.stylesFolder}/${name}.yaml`)
          .addButton((button) => button.setButtonText('Open').onClick(() => {
            void this.app.workspace.openLinkText(`${service.stylesFolder}/${name}.yaml`, '', true);
          }));
    }
  }

  /** Read-only view of the scoping: profiles and note types from linter.yaml. */
  private displayScopesSummary(): void {
    const config = this.plugin.lappeConfig.config;
    new Setting(this.contentEl).setName('Scopes').setDesc('Profiles from linter.yaml decide which rules run where: by folder or path glob, by tag, by frontmatter property, or by extension. Edit them in linter.yaml.').setHeading();

    const profiles = Object.entries(config?.profiles ?? {});
    if (profiles.length === 0) {
      this.contentEl.createEl('div', {text: 'No profiles defined; the defaults apply to every file.'}).style.color = 'var(--text-muted)';
    }
    for (const [name, profile] of profiles) {
      const parts: string[] = [];
      const match = profile.match ?? {};
      if (match.path?.length) {
        parts.push(`paths: ${match.path.join(', ')}`);
      }
      if (match.tag?.length) {
        parts.push(`tags: ${match.tag.join(', ')}`);
      }
      if (match.frontmatter) {
        parts.push(`properties: ${Object.entries(match.frontmatter).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}`);
      }
      if (match.extension?.length) {
        parts.push(`extensions: ${match.extension.join(', ')}`);
      }
      new Setting(this.contentEl.createDiv())
          .setName(name)
          .setDesc(parts.length ? parts.join(' | ') : 'reachable only via a linter-profile frontmatter key');
    }

    const noteTypes = Object.keys(config?.['note-types'] ?? {});
    if (noteTypes.length > 0) {
      new Setting(this.contentEl.createDiv())
          .setName('Note types')
          .setDesc(noteTypes.join(', '));
    }
  }
}
