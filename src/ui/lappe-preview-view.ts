import {ItemView, MarkdownRenderer, Setting, WorkspaceLeaf} from 'obsidian';
import type LinterPlugin from '../main';
import {lintText as lappeLintText} from '@lappe-linter/core';
import {PREVIEW_SAMPLE, PREVIEW_SAMPLE_PATH} from '../lappe/preview-sample';

export const LAPPE_PREVIEW_VIEW_TYPE = 'lappe-linter-preview';

/**
 * Non-modal preview workspace: the real rendered Markdown note stays on the
 * left while the effective Lappe settings stay visible on the right. The
 * view owns one live config listener so edits to linter.yaml are reflected
 * without closing the settings surface.
 */
export class LappePreviewView extends ItemView {
  private detach: (() => void) | null = null;
  private noteEl: HTMLElement;
  private settingsEl: HTMLElement;
  private renderToken = 0;

  constructor(leaf: WorkspaceLeaf, private plugin: LinterPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return LAPPE_PREVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Lappe Linter preview';
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('lappe-preview-workspace');
    const wrapper = this.contentEl.createDiv();
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = 'minmax(0, 1.5fr) minmax(280px, 1fr)';
    wrapper.style.gap = '16px';
    wrapper.style.height = '100%';
    wrapper.style.padding = '16px';
    this.noteEl = this.panel(wrapper, 'Preview note');
    this.settingsEl = this.panel(wrapper, 'Current settings');
    await this.render();

    // Subscribe to config reloads rather than the vault 'modify' event: UI edits
    // in the Lappe tab (and this view's own controls) persist through
    // adapter.write, which never fires 'modify', so a file-watcher would leave
    // the preview stale. The config service notifies after every load(), which
    // also covers external linter.yaml edits (git pull, hand edit).
    this.detach = this.plugin.lappeConfig.onChange(() => {
      void this.render();
    });
  }

  onClose(): void {
    this.detach?.();
    this.detach = null;
    this.contentEl.empty();
  }

  private panel(parent: HTMLElement, title: string): HTMLElement {
    const panel = parent.createDiv();
    panel.style.minWidth = '0';
    panel.style.overflow = 'auto';
    new Setting(panel).setName(title).setHeading();
    return panel;
  }

  private async render(): Promise<void> {
    const token = ++this.renderToken;
    const config = this.plugin.lappeConfig?.config;
    this.noteEl.empty();
    this.settingsEl.empty();
    new Setting(this.noteEl).setName('Rendered Markdown').setHeading();
    if (config == null) {
      this.noteEl.createEl('p', {text: 'linter.yaml is invalid or not loaded. Fix the file and reload the preview.'});
      new Setting(this.settingsEl).setName('Configuration unavailable').setDesc('The preview is fail-closed until linter.yaml parses.');
      return;
    }

    try {
      const result = lappeLintText({text: PREVIEW_SAMPLE, path: PREVIEW_SAMPLE_PATH, config, today: '2026-07-10'});
      await MarkdownRenderer.render(this.plugin.app, result.text, this.noteEl, PREVIEW_SAMPLE_PATH, this);
      if (token !== this.renderToken) {
        return;
      }
      this.renderSettingsSummary(result.text, result.profileChain, result.violations.length);
    } catch (error) {
      this.noteEl.createEl('p', {text: `Preview failed: ${String(error)}`});
      this.settingsEl.createEl('p', {text: 'Fix the configuration or inspect the Debug tab for details.'});
    }
  }

  private renderSettingsSummary(renderedText: string, profileChain: string[], violationCount: number): void {
    const config = this.plugin.lappeConfig.config;
    const defaults = config.defaults?.rules ?? {};
    const keyOrder = defaults['yaml-key-sort']?.['priority-keys'];
    new Setting(this.settingsEl)
        .setName('Config source')
        .setDesc(this.plugin.lappeConfig.path ?? 'compiled defaults');
    new Setting(this.settingsEl)
        .setName('Profile chain')
        .setDesc(profileChain.join(' → '));
    new Setting(this.settingsEl)
        .setName('YAML order')
        .setDesc(Array.isArray(keyOrder) ? keyOrder.join(' → ') : 'default order');
    const paragraphSpacing = defaults['paragraph-spacing']?.['blank-lines'];
    new Setting(this.settingsEl)
        .setName('Paragraph spacing')
        .addDropdown((dropdown) => {
          dropdown.addOption('0', '0');
          dropdown.addOption('1', '1');
          dropdown.addOption('2', '2');
          dropdown.setValue(String(typeof paragraphSpacing === 'number' ? paragraphSpacing : 1));
          dropdown.onChange(async (value) => {
            await this.plugin.lappeConfig.setDefaultRuleOption('paragraph-spacing', 'blank-lines', Number(value));
          });
        });
    const marker = defaults['list-style']?.['marker'] === '*' ? '*' : '-';
    new Setting(this.settingsEl)
        .setName('Bullet marker')
        .addDropdown((dropdown) => {
          dropdown.addOption('-', '-');
          dropdown.addOption('*', '*');
          dropdown.setValue(marker);
          dropdown.onChange(async (value) => {
            await this.plugin.lappeConfig.setDefaultRuleOption('list-style', 'marker', value);
          });
        });
    new Setting(this.settingsEl)
        .setName('Formatting')
        .setDesc(`H1/paragraph/list rules are applied to ${PREVIEW_SAMPLE_PATH}; ${violationCount} rule result${violationCount === 1 ? '' : 's'}.`);
    new Setting(this.settingsEl)
        .setName('Rendered output')
        .setDesc(`${renderedText.split('\n').length} lines after linting.`);
    new Setting(this.settingsEl)
        .setName('Test target')
        .setDesc('Change linter.yaml, then watch this note update without closing the workspace view.');
  }
}
