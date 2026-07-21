import {ItemView, WorkspaceLeaf} from 'obsidian';
import {
  BlankLineCount,
  HeadingCase,
  HighlightAction,
  PreviewMode,
  ReflowMode,
  ScopeType,
  StructuralAction,
  renderConfigPreview,
  ruleExecutionOrder,
} from '../lappe/linter-config-core';
import type LinterPlugin from '../main';

export const LINTER_CONFIG_VIEW_TYPE = 'lappe-linter-config';

const HEADING_CASES: HeadingCase[] = [
  'kebab-case',
  'camelCase',
  'PascalCase',
  'sentence-case',
  'Title Case',
  'lowercase',
  'UPPERCASE',
  'unchanged',
];
const BLANK_LINE_COUNTS: BlankLineCount[] = [0, 1, 2];
const SCOPE_TYPES: ScopeType[] = ['domain', 'category', 'sub-category', 'folder', 'project', 'tag'];

/**
 * Two-pane linter + base-template config workspace. This UI was built into the
 * product-management plugin by mistake; linting belongs to lappe-linter, so it
 * lives here now. It drives its own `linterConfigPreview` settings (seeded from
 * defaults, so it renders out of the box) and shows a live preview beside the
 * controls: a "Linter rules" tab and a "Base template" tab.
 */
export class LinterConfigView extends ItemView {
  private mode: PreviewMode = 'linter';

  constructor(
      leaf: WorkspaceLeaf,
    private readonly plugin: LinterPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return LINTER_CONFIG_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Linter config';
  }

  getIcon(): string {
    return 'panel-left';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('lappe-lc-view');
    root.addClass('lappe-config-preview');

    const shell = root.createDiv({cls: 'lappe-config-shell'});
    this.renderPreviewPane(shell);
    this.renderConfigPane(shell);
  }

  private renderPreviewPane(shell: HTMLElement): void {
    const pane = shell.createDiv({cls: 'lappe-config-pane lappe-config-preview-pane'});
    const header = pane.createDiv({cls: 'lappe-config-pane-header'});
    header.createEl('h2', {text: this.mode === 'linter' ? 'Linter preview' : 'Base preview'});
    header.createEl('p', {
      text:
        this.mode === 'linter' ?
          'Synthetic note seeded from the active base template, then formatted by the current rule set.' :
          'Representative note generated from the base template, property schema, and selected scope.',
    });
    pane.createEl('pre', {
      cls: 'lappe-config-rendered-note',
      text: renderConfigPreview({
        mode: this.mode,
        settings: this.plugin.settings.linterConfigPreview,
      }),
    });
  }

  private renderConfigPane(shell: HTMLElement): void {
    const pane = shell.createDiv({cls: 'lappe-config-pane lappe-config-controls-pane'});
    const tabs = pane.createDiv({cls: 'lappe-lc-tabs'});
    this.renderModeTab(tabs, 'linter', 'Linter rules');
    this.renderModeTab(tabs, 'base', 'Base template');

    if (this.mode === 'linter') {
      this.renderLinterControls(pane);
    } else {
      this.renderBaseControls(pane);
    }
  }

  private renderModeTab(tabs: HTMLElement, mode: PreviewMode, label: string): void {
    const tab = tabs.createEl('button', {
      cls: mode === this.mode ? 'lappe-lc-tab is-active' : 'lappe-lc-tab',
      text: label,
    });
    this.registerDomEvent(tab, 'click', () => {
      this.mode = mode;
      this.render();
    });
  }

  private renderLinterControls(pane: HTMLElement): void {
    const settings = this.plugin.settings.linterConfigPreview;
    const config = settings.linter;
    const section = pane.createDiv({cls: 'lappe-config-section'});
    section.createEl('h3', {text: 'Headings'});
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      this.renderSelect(section, `H${level} casing`, config.headingCaseByLevel[level], HEADING_CASES, async (value) => {
        config.headingCaseByLevel[level] = value;
        await this.persistAndRender();
      });
    }
    this.renderNumberSelect(section, 'Blank line before heading', config.blankLinesBeforeHeading, async (value) => {
      config.blankLinesBeforeHeading = value;
      await this.persistAndRender();
    });
    this.renderNumberSelect(section, 'Blank line after heading', config.blankLinesAfterHeading, async (value) => {
      config.blankLinesAfterHeading = value;
      await this.persistAndRender();
    });

    const spacing = pane.createDiv({cls: 'lappe-config-section'});
    spacing.createEl('h3', {text: 'Spacing and lists'});
    this.renderNumberSelect(spacing, 'Blank lines between paragraphs', config.blankLinesBetweenParagraphs, async (value) => {
      config.blankLinesBetweenParagraphs = value;
      await this.persistAndRender();
    });
    this.renderNumberSelect(spacing, 'Blank lines between list items', config.blankLinesBetweenListItems, async (value) => {
      config.blankLinesBetweenListItems = value;
      await this.persistAndRender();
    });
    this.renderSelect(spacing, 'Unordered marker', config.unorderedMarker, ['-', '*'], async (value) => {
      config.unorderedMarker = value;
      await this.persistAndRender();
    });
    this.renderSelect(spacing, 'Ordered marker', config.orderedMarker, ['sequential', 'all-ones'], async (value) => {
      config.orderedMarker = value;
      await this.persistAndRender();
    });

    const emphasis = pane.createDiv({cls: 'lappe-config-section'});
    emphasis.createEl('h3', {text: 'Emphasis'});
    this.renderSelect(emphasis, 'Bold', config.bold, ['keep', 'normalize', 'remove'], async (value) => {
      config.bold = value;
      await this.persistAndRender();
    });
    this.renderSelect(emphasis, 'Italic', config.italic, ['keep', 'normalize', 'remove'], async (value) => {
      config.italic = value;
      await this.persistAndRender();
    });
    this.renderSelect(emphasis, 'Underscore emphasis', config.underscore, ['keep', 'convert-to-asterisk', 'remove'], async (value) => {
      config.underscore = value;
      await this.persistAndRender();
    });
    this.renderSelect(emphasis, 'Highlight', config.highlight, ['keep', 'remove'], async (value: HighlightAction) => {
      config.highlight = value;
      await this.persistAndRender();
    });

    const wrapping = pane.createDiv({cls: 'lappe-config-section'});
    wrapping.createEl('h3', {text: 'Line breaks and execution order'});
    this.renderToggle(wrapping, 'Strip hard breaks', config.stripHardBreaks, async (value) => {
      config.stripHardBreaks = value;
      await this.persistAndRender();
    });
    this.renderToggle(wrapping, 'Strip HTML breaks', config.stripHtmlBreaks, async (value) => {
      config.stripHtmlBreaks = value;
      await this.persistAndRender();
    });
    this.renderSelect(wrapping, 'Reflow mode', config.reflowMode, ['soft-wrap', 'fixed-column'], async (value: ReflowMode) => {
      config.reflowMode = value;
      await this.persistAndRender();
    });
    this.renderText(wrapping, 'Column width', String(config.columnWidth), async (value) => {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        config.columnWidth = parsed;
        await this.persistAndRender();
      }
    });
    this.renderSelect(wrapping, 'Rules below lock', config.ruleSortMode, ['manual', 'alphabetical'], async (value) => {
      config.ruleSortMode = value;
      await this.persistAndRender();
    });
    wrapping.createEl('p', {
      cls: 'lappe-config-help',
      text: `Locked order: ${ruleExecutionOrder(config).join(' -> ')}`,
    });

    const structural = pane.createDiv({cls: 'lappe-config-section'});
    structural.createEl('h3', {text: 'Special formatting'});
    this.renderSelect(structural, 'Code blocks', config.codeBlocks, ['keep', 'normalize', 'remove'], async (value: StructuralAction) => {
      config.codeBlocks = value;
      await this.persistAndRender();
    });
    this.renderSelect(structural, 'Block quotes', config.blockQuotes, ['keep', 'normalize', 'remove'], async (value: StructuralAction) => {
      config.blockQuotes = value;
      await this.persistAndRender();
    });
    this.renderSelect(structural, 'Tables', config.tables, ['keep', 'normalize', 'remove'], async (value: StructuralAction) => {
      config.tables = value;
      await this.persistAndRender();
    });
    this.renderSelect(structural, 'Callouts', config.callouts, ['keep', 'normalize', 'remove'], async (value: StructuralAction) => {
      config.callouts = value;
      await this.persistAndRender();
    });
  }

  private renderBaseControls(pane: HTMLElement): void {
    const settings = this.plugin.settings.linterConfigPreview;
    const base = settings.baseTemplate;
    const identity = pane.createDiv({cls: 'lappe-config-section'});
    identity.createEl('h3', {text: 'Base identity'});
    this.renderText(identity, 'Name', base.name, async (value) => {
      base.name = value.trim() || 'Product note';
      await this.persistAndRender();
    });
    this.renderText(identity, 'Folder', base.folder, async (value) => {
      base.folder = value.trim();
      await this.persistAndRender();
    });

    const properties = pane.createDiv({cls: 'lappe-config-section'});
    properties.createEl('h3', {text: 'Property schema'});
    this.renderText(properties, 'Domain', base.domain, async (value) => {
      base.domain = value.trim();
      await this.persistAndRender();
    });
    this.renderText(properties, 'Category', base.category, async (value) => {
      base.category = value.trim();
      await this.persistAndRender();
    });
    this.renderText(properties, 'Sub-category', base.subCategory, async (value) => {
      base.subCategory = value.trim();
      await this.persistAndRender();
    });
    this.renderCsv(properties, 'Projects', base.project, async (values) => {
      base.project = values;
      await this.persistAndRender();
    });
    this.renderCsv(properties, 'Seed tags', base.tags, async (values) => {
      base.tags = values;
      await this.persistAndRender();
    });
    this.renderCsv(properties, 'Pinned override keys', base.pinnedOverrideKeys, async (values) => {
      base.pinnedOverrideKeys = values;
      await this.persistAndRender();
    });

    const scope = pane.createDiv({cls: 'lappe-config-section'});
    scope.createEl('h3', {text: 'Scopes'});
    for (let index = 0; index < base.scope.length; index += 1) {
      const current = base.scope[index];
      const row = scope.createDiv({cls: 'lappe-config-scope-row'});
      this.renderSelect(row, 'Type', current.type, SCOPE_TYPES, async (value) => {
        current.type = value;
        await this.persistAndRender();
      });
      this.renderCsv(row, 'Values', current.values, async (values) => {
        current.values = values;
        await this.persistAndRender();
      });
    }
    const addScope = scope.createEl('button', {text: 'Add scope'});
    this.registerDomEvent(addScope, 'click', () => {
      base.scope.push({type: 'folder', values: [base.folder]});
      void this.persistAndRender();
    });

    const template = pane.createDiv({cls: 'lappe-config-section'});
    template.createEl('h3', {text: 'Template body'});
    const textarea = template.createEl('textarea', {cls: 'lappe-config-textarea'}) as HTMLTextAreaElement;
    textarea.value = base.templateBody;
    this.registerDomEvent(textarea, 'change', () => {
      base.templateBody = textarea.value;
      void this.persistAndRender();
    });
  }

  private renderText(parent: HTMLElement, label: string, value: string, onChange: (value: string) => Promise<void>): void {
    const row = this.renderFieldShell(parent, label);
    const input = row.createEl('input', {cls: 'lappe-config-input'}) as HTMLInputElement;
    input.value = value;
    // Re-rendering on every keystroke replaces the input and loses the user's
    // cursor. Commit text fields on change so typing remains uninterrupted.
    this.registerDomEvent(input, 'change', () => void onChange(input.value));
  }

  private renderCsv(parent: HTMLElement, label: string, values: string[], onChange: (values: string[]) => Promise<void>): void {
    this.renderText(parent, label, values.join(', '), async (value) => {
      await onChange(value.split(',').map((part) => part.trim()).filter(Boolean));
    });
  }

  private renderToggle(parent: HTMLElement, label: string, value: boolean, onChange: (value: boolean) => Promise<void>): void {
    const row = this.renderFieldShell(parent, label);
    const input = row.createEl('input', {cls: 'lappe-config-checkbox'}) as HTMLInputElement;
    input.type = 'checkbox';
    input.checked = value;
    this.registerDomEvent(input, 'change', () => void onChange(input.checked));
  }

  private renderNumberSelect(
      parent: HTMLElement,
      label: string,
      value: BlankLineCount,
      onChange: (value: BlankLineCount) => Promise<void>,
  ): void {
    this.renderSelect(parent, label, value, BLANK_LINE_COUNTS, onChange);
  }

  private renderSelect<T extends string | number>(
      parent: HTMLElement,
      label: string,
      value: T,
      options: readonly T[],
      onChange: (value: T) => Promise<void>,
  ): void {
    const row = this.renderFieldShell(parent, label);
    const select = row.createEl('select', {cls: 'lappe-config-select'}) as HTMLSelectElement;
    for (const option of options) {
      const optionEl = select.createEl('option', {text: String(option)}) as HTMLOptionElement;
      optionEl.value = String(option);
    }
    select.value = String(value);
    this.registerDomEvent(select, 'change', () => {
      const selected = options.find((option) => String(option) === select.value) ?? value;
      void onChange(selected);
    });
  }

  private renderFieldShell(parent: HTMLElement, label: string): HTMLElement {
    const row = parent.createDiv({cls: 'lappe-config-field'});
    row.createEl('label', {text: label});
    return row;
  }

  private async persistAndRender(): Promise<void> {
    await this.plugin.saveSettings();
    this.plugin.refreshLinterConfigViews();
  }
}
