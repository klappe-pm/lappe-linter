import {App, Notice, Setting, TFolder} from 'obsidian';
import {getRules, HEADER_CASE_STYLES} from '@lappe-linter/core';
import LinterPlugin from '../../../main';
import {Tab} from './tab';
import {ListSuggest, vaultYamlKeys, vaultYamlValues} from '../../../lappe/yaml-suggest';
import {moveItem} from '../../../lappe/reorder';
import {rulesDict} from '../../../rules';
import {BooleanOption, SearchOptionInfo} from '../../../option';
import {buildMatch, ScopeSelection, SCOPE_TYPES} from '../../../lappe/scope-builder-model';

// Kept upstream YAML formatting rules, surfaced in the Lappe YAML section.
// yaml-title, yaml-title-alias, and every footnote rule are intentionally
// absent: they are hidden from the settings entirely (dec-005 removed the
// upstream YAML and Footnote tabs; these are not re-surfaced).
const KEPT_YAML_RULE_ALIASES = ['add-blank-line-after-yaml', 'dedupe-yaml-array-values', 'remove-yaml-keys'];

export type LappeSurface = 'YAML' | 'Headers' | 'Body' | 'Special formatting' | 'Scopes' | 'Rule order';

/**
 * One requested settings surface backed by linter.yaml. The implementation is
 * shared so each tab writes through the same comment-preserving service while
 * the navigation remains explicit and discoverable.
 */
export class LappeTab extends Tab {
  constructor(navEl: HTMLElement, settingsEl: HTMLElement, isMobile: boolean, plugin: LinterPlugin, private app: App, private surface: LappeSurface) {
    super(navEl, settingsEl, surface, isMobile, plugin);
    this.display();
  }

  display(): void {
    this.contentEl.empty();
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

    switch (this.surface) {
      case 'YAML':
        this.displayKeySortSection();
        this.displayKeptYamlRules();
        break;
      case 'Headers':
        this.displayHeadersSection();
        break;
      case 'Body':
        this.displayBodySection();
        break;
      case 'Special formatting':
        this.displaySpecialFormattingSection();
        break;
      case 'Scopes':
        this.displayScopesSummary();
        this.displayCodeChecksSection();
        this.displayExcludedFoldersSection();
        this.displayTestFilesSection();
        this.displayStylesSection();
        this.displayRuleToggles();
        break;
      case 'Rule order':
        this.displayRuleOrderSection();
        break;
    }
  }

  /**
   * Declarative code checks (dec-006): pattern rules over fenced code blocks,
   * defined in linter.yaml, never executed code. Built-ins toggle here; custom
   * checks defined in linter.yaml appear alongside them.
   */
  private displayCodeChecksSection(): void {
    const service = this.plugin.lappeConfig;
    new Setting(this.contentEl)
        .setName('Code checks')
        .setDesc('Pattern checks over fenced code blocks, defined in linter.yaml under code-checks. Checks are bounded regex over your own notes; they never run code. See docs/code-checks.md for authoring your own.')
        .setHeading();

    for (const check of service.codeCheckState()) {
      new Setting(this.contentEl.createDiv())
          .setName(check.id + (check.builtin ? '' : ' (custom)'))
          .setDesc(check.description)
          .addToggle((toggle) => toggle.setValue(check.enabled).onChange(async (value) => {
            await service.setCodeCheckEnabled(check.id, value);
          }));
    }
  }

  /**
   * Headers section: per-level heading case (header-case rule, written to
   * linter.yaml h1..h6) plus the kept upstream heading rules. H1 is normally
   * driven by the filename via h1-matches-stem, so its dropdown notes that.
   */
  private displayHeadersSection(): void {
    const service = this.plugin.lappeConfig;
    this.sectionHeading('Headers', 'Per-level heading case. Each level can be left alone or normalized to one style. H1 follows the filename (kebab-case) via the filename rules; set it here only to override.');

    const headerCaseStanza = service.config?.defaults?.rules?.['header-case'] ?? {};
    for (let level = 1; level <= 6; level++) {
      const key = `h${level}`;
      const current = typeof headerCaseStanza[key] === 'string' ? headerCaseStanza[key] as string : '';
      new Setting(this.contentEl.createDiv())
          .setName(`H${level} case`)
          .setDesc(level === 1 ? 'Default: follows the filename (kebab-case).' : '')
          .addDropdown((dropdown) => {
            dropdown.addOption('', 'Leave alone');
            for (const style of HEADER_CASE_STYLES) {
              dropdown.addOption(style, style);
            }
            dropdown.setValue(current);
            dropdown.onChange(async (value) => {
              await service.setDefaultRuleOption('header-case', key, value === '' ? null : value);
            });
          });
    }

    // Kept upstream heading rules, shipped on (opt-out).
    for (const alias of ['header-increment', 'headings-start-line', 'trailing-spaces']) {
      this.renderUpstreamRule(alias);
    }
    this.displayFilenameSection();
  }

  /** Filename is the first H1 source; the rename handler skips Untitled files. */
  private displayFilenameSection(): void {
    const service = this.plugin.lappeConfig;
    new Setting(this.contentEl).setName('Filename and first H1').setDesc('Real filenames use kebab-case by default. Obsidian Untitled files are ignored until a real name is entered, then the first H1 follows the filename.').setHeading();
    for (const [ruleId, name] of [['kebab-case-filename', 'Kebab-case filename'], ['h1-matches-stem', 'First H1 follows filename']] as const) {
      const enabled = service.config?.defaults?.rules?.[ruleId]?.enabled !== false;
      new Setting(this.contentEl.createDiv())
          .setName(name)
          .setDesc(ruleId === 'kebab-case-filename' ? 'Report a non-kebab filename and propose the compliant rename.' : 'Set or update the first H1 from the real filename after the Untitled transition.')
          .addToggle((toggle) => toggle.setValue(enabled).onChange(async (value) => {
            await service.setDefaultRuleEnabled(ruleId, value);
          }));
    }
  }

  /** A section heading with a "Preview" button opening the live preview modal. */
  private sectionHeading(name: string, desc: string): void {
    new Setting(this.contentEl)
        .setName(name)
        .setDesc(desc)
        .setHeading()
        .addButton((button) => button.setButtonText('Preview').setTooltip('Preview these settings on a sample note').onClick(() => {
          this.plugin.openLappePreview();
        }));
  }

  /**
   * Render one upstream rule (heading link plus its option controls) into the
   * Lappe tab, hiding the sub-options when the rule is disabled, exactly as
   * the upstream RuleTab does. Shared by the YAML, Headers, Body, and Special
   * sections so those surfaces stay consistent.
   */
  private renderUpstreamRule(alias: string): void {
    const rule = rulesDict[alias];
    if (rule == null) {
      return;
    }
    const ruleDiv = this.contentEl.createDiv();
    ruleDiv.id = `lappe-${rule.alias}`;
    new Setting(ruleDiv).setHeading().nameEl.createEl('a', {href: rule.getURL(), text: rule.getName()});
    const optionInfo: SearchOptionInfo[] = [];
    let isFirstOption = true;
    let hideOnLoad = false;
    for (const option of rule.options) {
      option.display(ruleDiv, this.plugin.settings, this.plugin);
      optionInfo.push(option.getSearchInfo());
      if (isFirstOption) {
        isFirstOption = false;
        if (option instanceof BooleanOption) {
          hideOnLoad = !this.plugin.settings.ruleConfigs[option.ruleAlias][option.configKey];
        }
      } else if (hideOnLoad) {
        option.hide();
      }
    }
  }

  /**
   * The kept upstream YAML formatting rules (blank line after YAML, dedupe
   * array values, remove keys). These run in the upstream pass; the Lappe
   * defaults ship them on. yaml-title, title alias, and footnote rules are
   * not surfaced.
   */
  private displayKeptYamlRules(): void {
    this.sectionHeading('YAML formatting', 'Extra frontmatter cleanups applied on lint. These default on; turn any off to opt out.');
    for (const alias of KEPT_YAML_RULE_ALIASES) {
      this.renderUpstreamRule(alias);
    }
  }

  /**
   * Body section: paragraph spacing, bullet style, artificial line-break
   * removal (all lappe-core rules written to linter.yaml), plus Basic Styling
   * (upstream emphasis and strong marker rules).
   */
  private displayBodySection(): void {
    const service = this.plugin.lappeConfig;
    this.sectionHeading('Body', 'Paragraph, list, and basic text styling applied on lint.');

    const paraStanza = service.config?.defaults?.rules?.['paragraph-spacing'] ?? {};
    const currentBlank = typeof paraStanza['blank-lines'] === 'number' ? String(paraStanza['blank-lines']) : '1';
    new Setting(this.contentEl.createDiv())
        .setName('Blank lines between paragraphs')
        .setDesc('How many blank lines separate blocks. Existing gaps are normalized to this count; adjacent lines are not split.')
        .addDropdown((dropdown) => {
          dropdown.addOption('0', '0');
          dropdown.addOption('1', '1');
          dropdown.addOption('2', '2');
          dropdown.setValue(currentBlank);
          dropdown.onChange(async (value) => {
            await service.setDefaultRuleOption('paragraph-spacing', 'blank-lines', Number(value));
          });
        });

    const listStanza = service.config?.defaults?.rules?.['list-style'] ?? {};
    const currentMarker = listStanza['marker'] === '*' ? '*' : '-';
    new Setting(this.contentEl.createDiv())
        .setName('Bullet marker')
        .setDesc('The marker used for unordered list items.')
        .addDropdown((dropdown) => {
          dropdown.addOption('-', '- (dash)');
          dropdown.addOption('*', '* (asterisk)');
          dropdown.setValue(currentMarker);
          dropdown.onChange(async (value) => {
            await service.setDefaultRuleOption('list-style', 'marker', value);
          });
        });
    new Setting(this.contentEl.createDiv())
        .setName('Tight lists')
        .setDesc('Remove blank lines between consecutive list items.')
        .addToggle((toggle) => toggle.setValue(listStanza['tighten'] !== false).onChange(async (value) => {
          await service.setDefaultRuleOption('list-style', 'tighten', value);
        }));

    const joinStanza = service.config?.defaults?.rules?.['join-paragraph-lines'];
    new Setting(this.contentEl.createDiv())
        .setName('Remove artificial line breaks')
        .setDesc('Unwrap hard-wrapped prose (pasted text, email, fixed-width) so lines wrap naturally. Lists, quotes, code, and intentional breaks are preserved.')
        .addToggle((toggle) => toggle.setValue(joinStanza?.enabled === true).onChange(async (value) => {
          await service.setDefaultRuleEnabled('join-paragraph-lines', value);
        }));

    new Setting(this.contentEl).setName('Basic styling').setDesc('Bold and italic marker styles.').setHeading();
    for (const alias of ['emphasis-style', 'strong-style']) {
      this.renderUpstreamRule(alias);
    }
  }

  /**
   * Special formatting: code fences, quotes, and tables. Same layout as the
   * other sections; groups the upstream block-formatting rules.
   */
  private displaySpecialFormattingSection(): void {
    this.sectionHeading('Special formatting', 'Markdown block formatting: code fences, quotes, and tables.');
    for (const alias of ['default-language-for-code-fences', 'empty-line-around-code-fences', 'blockquote-style', 'empty-line-around-blockquotes', 'empty-line-around-tables']) {
      this.renderUpstreamRule(alias);
    }
  }

  /**
   * The one combined control: "this is the order YAML keys get sorted in".
   * A visible ordered list with an autocomplete key input (all vault keys,
   * Enter adds) and a same-pattern optional default-value input beside it.
   */
  private displayKeySortSection(): void {
    const service = this.plugin.lappeConfig;

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

    this.renderKeySortList(listEl);

    // Add row: key + optional default value, both autocomplete, Enter adds.
    const addRow = section.createDiv({cls: 'lappe-key-sort-add'});
    addRow.style.display = 'flex';
    addRow.style.gap = '8px';
    addRow.style.alignItems = 'center';

    const keyInput = addRow.createEl('input', {type: 'text', placeholder: 'key (click for all vault keys)'});
    keyInput.style.flex = '2';
    const valueInput = addRow.createEl('input', {type: 'text', placeholder: 'default value (optional)'});
    valueInput.style.flex = '2';

    new ListSuggest(this.app, keyInput, () => {
      const listed = service.yamlKeySortState().keys;
      return vaultYamlKeys(this.app).filter((k) => !listed.includes(k));
    });
    new ListSuggest(this.app, valueInput, () => keyInput.value.trim() === '' ? [] : vaultYamlValues(this.app, keyInput.value.trim()));

    const commit = () => {
      const key = keyInput.value.trim();
      if (key === '') {
        return;
      }
      // Read fresh state: the list may have been edited since this closure
      // was built, and the section is no longer rebuilt on every persist.
      const current = service.yamlKeySortState();
      if (current.keys.includes(key)) {
        new Notice(`lappe-linter: "${key}" is already in the list`);
        return;
      }
      const defaults = {...current.defaults};
      const value = valueInput.value.trim();
      if (value !== '') {
        defaults[key] = value;
      }
      keyInput.value = '';
      valueInput.value = '';
      void this.persistKeySort(listEl, [...current.keys, key], defaults);
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
        .setDesc('date-created and date-revised are managed automatically as yyyy-MM-dd dates: created is set on first lint, revised bumps only when content actually changed. This is always on.');
  }

  /**
   * Render only the ordered key list from fresh config state. Rows drag to
   * reorder (with up/down buttons as a keyboard-accessible fallback); row
   * edits call persistKeySort, which re-renders this list alone instead of
   * rebuilding the whole tab, so scroll position and the add-row inputs
   * survive edits. aliases and tags are shown as pinned trailing rows: the
   * core always sorts them last, so they are not part of the draggable order.
   */
  private renderKeySortList(listEl: HTMLElement): void {
    const state = this.plugin.lappeConfig.yamlKeySortState();
    if (state.keys.length === 0) {
      listEl.createEl('div', {text: 'No keys yet. Add the first one below.'}).style.color = 'var(--text-muted)';
    }
    state.keys.forEach((key, index) => {
      const row = new Setting(listEl).setName(`${index + 1}. ${key}`);
      const defaultValue = state.defaults[key];
      if (defaultValue !== undefined) {
        row.setDesc(`default when missing: ${defaultValue}`);
      }
      this.makeKeyRowDraggable(listEl, row.settingEl, state.keys, state.defaults, index);
      row.addExtraButton((b) => b.setIcon('grip-vertical').setTooltip('Drag to reorder').setDisabled(true));
      row.addExtraButton((b) => b.setIcon('chevron-up').setTooltip('Move up').setDisabled(index === 0).onClick(() => {
        const keys = [...state.keys];
        [keys[index - 1], keys[index]] = [keys[index], keys[index - 1]];
        void this.persistKeySort(listEl, keys, state.defaults);
      }));
      row.addExtraButton((b) => b.setIcon('chevron-down').setTooltip('Move down').setDisabled(index === state.keys.length - 1).onClick(() => {
        const keys = [...state.keys];
        [keys[index], keys[index + 1]] = [keys[index + 1], keys[index]];
        void this.persistKeySort(listEl, keys, state.defaults);
      }));
      row.addExtraButton((b) => b.setIcon('x').setTooltip('Remove').onClick(() => {
        const keys = state.keys.filter((k) => k !== key);
        const defaults = {...state.defaults};
        delete defaults[key];
        void this.persistKeySort(listEl, keys, defaults);
      }));
    });

    // aliases and tags always sort last; show them so the full key order is
    // visible, but not draggable and not part of priority-keys.
    ['aliases', 'tags'].forEach((key, offset) => {
      const row = new Setting(listEl)
          .setName(`${state.keys.length + offset + 1}. ${key}`)
          .setDesc('always sorted last');
      row.settingEl.style.opacity = '0.65';
    });
  }

  /**
   * Wire HTML5 drag events on one key-sort row. Dragging a row onto another
   * moves it to that position and persists the new order. Uses a shared
   * dataset marker on the list element to carry the dragged index without a
   * closure over stale state.
   */
  private makeKeyRowDraggable(listEl: HTMLElement, rowEl: HTMLElement, keys: string[], defaults: Record<string, string>, index: number): void {
    rowEl.draggable = true;
    rowEl.style.cursor = 'grab';
    rowEl.addEventListener('dragstart', (event) => {
      listEl.dataset.dragFrom = String(index);
      rowEl.style.opacity = '0.4';
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      }
    });
    rowEl.addEventListener('dragend', () => {
      rowEl.style.opacity = '';
      delete listEl.dataset.dragFrom;
    });
    rowEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      rowEl.style.borderTop = '2px solid var(--interactive-accent)';
    });
    rowEl.addEventListener('dragleave', () => {
      rowEl.style.borderTop = '';
    });
    rowEl.addEventListener('drop', (event) => {
      event.preventDefault();
      rowEl.style.borderTop = '';
      const from = Number(listEl.dataset.dragFrom ?? event.dataTransfer?.getData('text/plain'));
      if (!Number.isInteger(from) || from === index) {
        return;
      }
      void this.persistKeySort(listEl, moveItem(keys, from, index), defaults);
    });
  }

  private async persistKeySort(listEl: HTMLElement, keys: string[], defaults: Record<string, string>): Promise<void> {
    const service = this.plugin.lappeConfig;
    const hadConfig = service.path != null;
    await service.updateYamlKeySort(keys, defaults);
    if (!hadConfig) {
      // The first edit just created linter.yaml; rebuild the whole tab so
      // the status header reflects the new file.
      this.display();
      return;
    }
    listEl.empty();
    this.renderKeySortList(listEl);
  }

  /**
   * Rule run order (F ordering). The first rule (yaml-key-sort) is locked
   * first with a lock icon; the rest reorder by drag (manual) or an
   * Alphabetical action, persisted to linter.yaml rule-order and honored by
   * the runner globally and, when a profile sets its own, per scope.
   */
  private displayRuleOrderSection(): void {
    const service = this.plugin.lappeConfig;
    const LOCKED = 'yaml-key-sort';

    // Effective order: stored order first, then any core rules not yet listed,
    // with the locked rule pinned to the front.
    const allIds = getRules().map((rule) => rule.id);
    const stored = service.ruleOrder().filter((id) => allIds.includes(id));
    const effective = [LOCKED, ...stored.filter((id) => id !== LOCKED)];
    for (const id of allIds) {
      if (!effective.includes(id)) {
        effective.push(id);
      }
    }

    new Setting(this.contentEl)
        .setName('Rule order')
        .setDesc('The order rules run in. The first rule is locked; drag the rest to reorder, or sort them alphabetically. Applies globally; a profile may set its own order.')
        .setHeading()
        .addButton((button) => button.setButtonText('Alphabetical').setTooltip('Sort all but the locked first rule alphabetically').onClick(async () => {
          const rest = effective.filter((id) => id !== LOCKED).sort((a, b) => a.localeCompare(b));
          await service.setRuleOrder([LOCKED, ...rest]);
          this.display();
        }));

    const listEl = this.contentEl.createDiv({cls: 'lappe-rule-order-list'});
    listEl.style.border = '1px solid var(--background-modifier-border)';
    listEl.style.borderRadius = '8px';
    listEl.style.padding = '8px';
    listEl.style.marginBottom = '8px';

    effective.forEach((id, index) => {
      const locked = id === LOCKED;
      const row = new Setting(listEl).setName(`${index + 1}. ${id}`);
      if (locked) {
        row.setDesc('locked first');
        row.addExtraButton((b) => b.setIcon('lock').setTooltip('This rule always runs first').setDisabled(true));
        row.settingEl.style.opacity = '0.8';
        return;
      }
      this.makeRuleOrderRowDraggable(listEl, row.settingEl, effective, index, LOCKED);
      row.addExtraButton((b) => b.setIcon('grip-vertical').setTooltip('Drag to reorder').setDisabled(true));
      row.addExtraButton((b) => b.setIcon('chevron-up').setTooltip('Move up').setDisabled(index <= 1).onClick(async () => {
        await service.setRuleOrder(moveItem(effective, index, index - 1));
        this.display();
      }));
      row.addExtraButton((b) => b.setIcon('chevron-down').setTooltip('Move down').setDisabled(index === effective.length - 1).onClick(async () => {
        await service.setRuleOrder(moveItem(effective, index, index + 1));
        this.display();
      }));
    });
  }

  private makeRuleOrderRowDraggable(listEl: HTMLElement, rowEl: HTMLElement, order: string[], index: number, locked: string): void {
    rowEl.draggable = true;
    rowEl.style.cursor = 'grab';
    rowEl.addEventListener('dragstart', (event) => {
      listEl.dataset.dragFrom = String(index);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      }
    });
    rowEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      rowEl.style.borderTop = '2px solid var(--interactive-accent)';
    });
    rowEl.addEventListener('dragleave', () => {
      rowEl.style.borderTop = '';
    });
    rowEl.addEventListener('drop', (event) => {
      event.preventDefault();
      rowEl.style.borderTop = '';
      const from = Number(listEl.dataset.dragFrom ?? event.dataTransfer?.getData('text/plain'));
      // Never move onto the locked slot (index 0) or a no-op.
      if (!Number.isInteger(from) || from === index || index === 0) {
        return;
      }
      const next = moveItem(order, from, index);
      if (next[0] !== locked) {
        return;
      }
      void this.plugin.lappeConfig.setRuleOrder(next).then(() => this.display());
    });
  }

  /** Enable/disable toggles for every registered core rule. */
  private displayRuleToggles(): void {
    const service = this.plugin.lappeConfig;
    const config = service.config;

    new Setting(this.contentEl).setName('Rules').setDesc('Core rules run on save and via the lappe-linter CLI, scoped by the profiles below. YAML key sort, timestamps, and property alphabetization are managed in the section above; note-type rules are configured per note type in linter.yaml.').setHeading();

    const managedElsewhere = new Set(['yaml-key-sort', 'yaml-timestamp', 'alphabetize-property-values', 'header-case', 'paragraph-spacing', 'list-style', 'join-paragraph-lines']);
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
   * A checkbox per vault folder; checked means excluded. Each toggle is one
   * comment-preserving write of ignore.folders in linter.yaml (the service
   * serializes concurrent toggles). Plain checkbox rows instead of Setting
   * toggles keep the render cheap in large vaults.
   */
  private displayExcludedFoldersSection(): void {
    const service = this.plugin.lappeConfig;
    new Setting(this.contentEl)
        .setName('Excluded folders')
        .setDesc('Checked folders are skipped by the scoped core rules: checking writes the folder into ignore.folders in linter.yaml, unchecking removes it. Comments in the file are preserved.')
        .setHeading();

    const listEl = this.contentEl.createDiv({cls: 'lappe-excluded-folders'});
    listEl.style.border = '1px solid var(--background-modifier-border)';
    listEl.style.borderRadius = '8px';
    listEl.style.padding = '8px';
    listEl.style.marginBottom = '8px';
    listEl.style.maxHeight = '300px';
    listEl.style.overflowY = 'auto';

    const folders = this.app.vault.getAllLoadedFiles()
        .filter((file): file is TFolder => file instanceof TFolder && !file.isRoot())
        .sort((a, b) => a.path.localeCompare(b.path));
    if (folders.length === 0) {
      listEl.createEl('div', {text: 'No folders in this vault.'}).style.color = 'var(--text-muted)';
      return;
    }

    const ignored = new Set(service.ignoredFolders());
    for (const folder of folders) {
      const depth = folder.path.split('/').length - 1;
      const row = listEl.createEl('label');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.padding = '2px 0';
      row.style.paddingLeft = `${depth * 20}px`;
      row.style.cursor = 'pointer';
      row.title = folder.path;
      const checkbox = row.createEl('input', {type: 'checkbox'});
      checkbox.checked = ignored.has(folder.path);
      row.createEl('span', {text: `${folder.name}/`});
      checkbox.addEventListener('change', () => {
        void service.setIgnoredFolder(folder.path, checkbox.checked);
      });
    }
  }

  /** Generate the disposable fixture folder demonstrating every core rule. */
  private displayTestFilesSection(): void {
    new Setting(this.contentEl)
        .setName('Test files')
        .setDesc('Writes a disposable fixture set to _archive/<date>-lappe-linter-test-files/: one messy file per core rule, a combined kitchen-sink.md, and a README. Lint them (lint-all or per file) to see each rule\'s effect. Leave _archive unchecked under Excluded folders so the fixtures actually lint.')
        .setHeading()
        .addButton((button) => button.setButtonText('Generate test files').onClick(async () => {
          button.setDisabled(true);
          try {
            await this.plugin.generateLappeTestFiles();
          } finally {
            button.setDisabled(false);
          }
        }));
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
        .setDesc(`Style files in ${service.stylesFolder}/ apply automatically as profiles. Each file binds itself to folders, tags, or properties via its match block and overrides rules for what it matches. Styles currently apply inside Obsidian only; the lappe-linter CLI does not read this folder yet.`)
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
    const service = this.plugin.lappeConfig;
    const config = service.config;
    new Setting(this.contentEl)
        .setName('Scopes')
        .setDesc('Profiles decide which rules run where. Each profile inherits the base settings above and overrides only what you change; unset options stay linked to the template.')
        .setHeading()
        .addButton((button) => button.setButtonText('Push template defaults').setTooltip('Drop per-profile overrides that now equal the base settings, relinking them to the template').onClick(async () => {
          const pruned = await service.pushDefaultsToProfiles();
          new Notice(`lappe-linter: relinked ${pruned} override${pruned === 1 ? '' : 's'} to the template`);
          this.display();
        }));

    this.renderScopeBuilder();

    const profiles = Object.entries(config?.profiles ?? {});
    if (profiles.length === 0) {
      this.contentEl.createEl('div', {text: 'No profiles yet; the base settings apply to every file.'}).style.color = 'var(--text-muted)';
    }
    for (const [name, profile] of profiles) {
      const match = profile.match ?? {};
      const summary = Object.entries(match)
          .map(([kind, value]) => `${kind}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
          .join(' | ');
      const overrides = Object.keys(profile.rules ?? {});
      const inheritance = overrides.length ? `; overrides ${overrides.join(', ')}` : ' (inherits everything)';
      const row = new Setting(this.contentEl.createDiv())
          .setName(name)
          .setDesc(`${summary || 'linter-profile override only'}${inheritance}`);
      row.addExtraButton((b) => b.setIcon('trash').setTooltip('Delete profile').onClick(async () => {
        await service.deleteProfile(name);
        this.display();
      }));
    }

    const noteTypes = Object.keys(config?.['note-types'] ?? {});
    if (noteTypes.length > 0) {
      new Setting(this.contentEl.createDiv()).setName('Note types').setDesc(noteTypes.join(', '));
    }
  }

  /**
   * The scope builder: pick one or more scope types, fill their values, name
   * the profile, and create it. Selecting a type reveals its value field; the
   * match is compiled from the pure scope-builder model and written to
   * linter.yaml as a new profile that inherits the base settings.
   */
  private renderScopeBuilder(): void {
    const service = this.plugin.lappeConfig;
    const container = this.contentEl.createDiv({cls: 'lappe-scope-builder'});
    container.style.border = '1px solid var(--background-modifier-border)';
    container.style.borderRadius = '8px';
    container.style.padding = '10px';
    container.style.marginBottom = '10px';

    const selections = new Map<string, ScopeSelection>();

    const nameRow = container.createDiv();
    nameRow.style.display = 'flex';
    nameRow.style.gap = '8px';
    nameRow.style.marginBottom = '8px';
    const nameInput = nameRow.createEl('input', {type: 'text', placeholder: 'new profile name'});
    nameInput.style.flex = '1';

    const fieldsEl = container.createDiv();

    new Setting(container)
        .setName('Scope types')
        .setDesc('Check the types this profile matches; a file must satisfy every checked type.');
    const typesEl = container.createDiv();
    typesEl.style.display = 'flex';
    typesEl.style.flexWrap = 'wrap';
    typesEl.style.gap = '10px';
    typesEl.style.marginBottom = '8px';

    const renderField = (scopeKey: string) => {
      const scope = SCOPE_TYPES.find((t) => t.key === scopeKey);
      if (scope == null) {
        return;
      }
      const field = fieldsEl.createDiv({cls: `lappe-scope-field-${scopeKey}`});
      field.style.display = 'flex';
      field.style.gap = '8px';
      field.style.alignItems = 'center';
      field.style.margin = '4px 0';
      field.createEl('label', {text: scope.label}).style.minWidth = '160px';
      if (scope.kind === 'range') {
        const after = field.createEl('input', {type: 'text', placeholder: 'after yyyy-MM-dd'});
        const before = field.createEl('input', {type: 'text', placeholder: 'before yyyy-MM-dd'});
        const update = () => selections.set(scopeKey, {type: scopeKey, range: {after: after.value.trim() || undefined, before: before.value.trim() || undefined}});
        after.addEventListener('input', update);
        before.addEventListener('input', update);
      } else {
        const input = field.createEl('input', {type: 'text', placeholder: scopeKey === 'properties' ? 'key=value, key=value' : 'comma-separated values'});
        input.style.flex = '1';
        new ListSuggest(this.app, input, () => this.scopeSuggestionValues(scopeKey));
        input.addEventListener('input', () => selections.set(scopeKey, {type: scopeKey, values: input.value.split(',').map((v) => v.trim()).filter(Boolean)}));
      }
    };

    for (const scope of SCOPE_TYPES) {
      const label = typesEl.createEl('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '4px';
      const checkbox = label.createEl('input', {type: 'checkbox'});
      label.createEl('span', {text: scope.label});
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          renderField(scope.key);
        } else {
          selections.delete(scope.key);
          fieldsEl.querySelector(`.lappe-scope-field-${scope.key}`)?.remove();
        }
      });
    }

    new Setting(container).addButton((button) => button.setButtonText('Create profile').setCta().onClick(async () => {
      const name = nameInput.value.trim();
      if (name === '') {
        new Notice('lappe-linter: name the profile first');
        return;
      }
      if (service.profileNames().includes(name)) {
        new Notice(`lappe-linter: profile "${name}" already exists`);
        return;
      }
      const match = buildMatch([...selections.values()]);
      if (Object.keys(match).length === 0) {
        new Notice('lappe-linter: choose at least one scope type with a value');
        return;
      }
      await service.upsertProfileMatch(name, match);
      new Notice(`lappe-linter: created profile "${name}"`);
      this.display();
    }));
  }

  /** Vault-backed suggestions for scope values; free-form values remain valid. */
  private scopeSuggestionValues(scopeKey: string): string[] {
    const markdownFiles = this.app.vault.getMarkdownFiles();
    const filePaths = markdownFiles.map((file) => file.path);
    const fileStems = markdownFiles.map((file) => file.path.replace(/\.md$/i, '').split('/').pop() ?? file.path);
    const unique = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    switch (scopeKey) {
      case 'folder':
        return unique(this.app.vault.getAllLoadedFiles()
            .filter((file): file is TFolder => file instanceof TFolder && !file.isRoot())
            .map((folder) => folder.path));
      case 'file':
      case 'path':
        return unique(filePaths);
      case 'extension':
        return unique(markdownFiles.map((file) => file.extension));
      case 'properties':
        return vaultYamlKeys(this.app).flatMap((key) => {
          const values = vaultYamlValues(this.app, key);
          return values.length === 0 ? [`${key}=`] : values.map((value) => `${key}=${value}`);
        });
      case 'tag':
        return unique([...vaultYamlValues(this.app, 'tags'), ...vaultYamlValues(this.app, 'tag')].map((value) => value.replace(/^#/, '')));
      case 'alias':
        return unique([...vaultYamlValues(this.app, 'aliases'), ...vaultYamlValues(this.app, 'alias')]);
      case 'backlink':
        return unique(fileStems);
      case 'domain':
      case 'category':
      case 'sub-category':
      case 'types':
      case 'project':
        return vaultYamlValues(this.app, scopeKey);
      case 'age':
        return Array.from({length: 20}, (_, index) => `${index * 5 + 1}-${index * 5 + 5}`);
      default:
        return [];
    }
  }
}
