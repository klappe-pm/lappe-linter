import {App, MarkdownRenderer, Setting} from 'obsidian';
import {aggregateEvents, renderReportMarkdown} from '@lappe-linter/core';
import LinterPlugin from '../../../main';
import {Tab} from './tab';

/**
 * Reports tab: rolls up the telemetry JSONL the lint/template hooks spool into
 * a usage/lint report, rendered with the vault's own Markdown renderer so it
 * inherits the active theme's fonts and colors (no custom CSS, no @font-face —
 * fully theme-native, per the design tokens contract). The heavy lifting is the
 * shared @lappe-linter/core aggregateEvents/renderReportMarkdown, the same code
 * the CLI `report` command and harness-logs-analysis use, so every surface
 * renders one shape.
 */
export class ReportsTab extends Tab {
  private renderedEl: HTMLElement;

  constructor(navEl: HTMLElement, settingsEl: HTMLElement, isMobile: boolean, plugin: LinterPlugin, private app: App) {
    super(navEl, settingsEl, 'Reports', isMobile, plugin);
    this.display();
  }

  display(): void {
    this.contentEl.empty();

    const sourceSetting = new Setting(this.contentEl)
        .setName('Telemetry source')
        .setDesc('Vault-relative path to the telemetry JSONL the lint and template hooks append to (template-events, run-summaries, and lint results).');
    sourceSetting.addText((text) => {
      text
          .setPlaceholder('.lappe/telemetry.jsonl')
          .setValue(this.plugin.settings.reportsSourcePath ?? '')
          .onChange(async (value) => {
            this.plugin.settings.reportsSourcePath = value.trim();
            await this.plugin.saveSettings();
          });
    });
    sourceSetting.addButton((button) =>
      button
          .setButtonText('Refresh')
          .setCta()
          .onClick(() => {
            void this.renderReport();
          }),
    );

    this.addSettingSearchInfo(this.contentEl as HTMLDivElement, 'Reports', 'template usage and lint run rollup');

    this.renderedEl = this.contentEl.createDiv('linter-tab-settings');
    void this.renderReport();
  }

  private async renderReport(): Promise<void> {
    this.renderedEl.empty();
    const path = (this.plugin.settings.reportsSourcePath ?? '').trim();
    if (!path) {
      this.renderedEl.createEl('p', {
        text: 'Set a telemetry source path above, then Refresh. Produce one by pointing the lint/template hooks or CLI (lappe-linter run … --json, template … --json) at a spool file.',
      });
      return;
    }

    let raw: string | null = null;
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(path)) {
        raw = await adapter.read(path);
      }
    } catch (error) {
      this.renderedEl.createEl('p', {text: `Could not read ${path}: ${(error as Error).message}`});
      return;
    }

    if (raw === null) {
      this.renderedEl.createEl('p', {text: `No telemetry found at "${path}" yet.`});
      return;
    }

    const summary = aggregateEvents(raw.split('\n'), null);
    const markdown = renderReportMarkdown(summary);
    await MarkdownRenderer.render(this.app, markdown, this.renderedEl, path, this.plugin);
  }
}
