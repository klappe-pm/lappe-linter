import {App, Modal, Notice, TFile} from 'obsidian';
import {lintText as lappeLintText} from '@lappe-linter/core';
import LinterPlugin from '../../main';
import {PREVIEW_SAMPLE, PREVIEW_SAMPLE_PATH} from '../../lappe/preview-sample';

/**
 * Live preview of the current lint configuration (F preview). Shows the sample
 * note before and after linting with the plugin's resolved lappe config, and
 * re-renders whenever linter.yaml changes on disk, so edits made in the
 * settings tab are reflected here.
 */
export class LappePreviewModal extends Modal {
  private afterEl: HTMLElement | null = null;
  private detach: (() => void) | null = null;

  constructor(app: App, private plugin: LinterPlugin) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText('Lappe Linter preview');
    this.modalEl.style.width = 'min(1100px, 95vw)';

    const wrapper = this.contentEl.createDiv();
    wrapper.style.display = 'flex';
    wrapper.style.gap = '16px';
    wrapper.style.alignItems = 'stretch';

    const before = this.column(wrapper, 'Sample input');
    this.pre(before).setText(PREVIEW_SAMPLE);

    const after = this.column(wrapper, 'After lint (current settings)');
    this.afterEl = this.pre(after);

    this.render();

    // Re-lint when the config or a style file changes on disk. The config
    // service reloads on the same events; a microtask defer lets it settle.
    const ref = this.app.vault.on('modify', (file) => {
      if (file instanceof TFile && (file.extension === 'yaml' || file.extension === 'yml' || file.name === 'linter.yaml')) {
        void Promise.resolve().then(() => this.render());
      }
    });
    this.detach = () => this.app.vault.offref(ref);
  }

  onClose(): void {
    this.detach?.();
    this.detach = null;
    this.contentEl.empty();
  }

  private column(parent: HTMLElement, title: string): HTMLElement {
    const col = parent.createDiv();
    col.style.flex = '1';
    col.style.minWidth = '0';
    col.createEl('h4').setText(title);
    const box = col.createDiv();
    box.style.border = '1px solid var(--background-modifier-border)';
    box.style.borderRadius = '8px';
    box.style.padding = '8px';
    box.style.overflowX = 'auto';
    return box;
  }

  private pre(box: HTMLElement): HTMLElement {
    const el = box.createEl('pre');
    el.style.whiteSpace = 'pre-wrap';
    el.style.margin = '0';
    return el;
  }

  private render(): void {
    if (this.afterEl == null) {
      return;
    }
    const config = this.plugin.lappeConfig?.config;
    if (config == null) {
      this.afterEl.setText('linter.yaml is invalid; fix it to see the preview.');
      return;
    }
    try {
      const result = lappeLintText({text: PREVIEW_SAMPLE, path: PREVIEW_SAMPLE_PATH, config, today: '2026-07-10'});
      this.afterEl.setText(result.text);
    } catch (error) {
      this.afterEl.setText(`preview failed: ${String(error)}`);
      new Notice('lappe-linter: preview failed to lint the sample');
    }
  }
}
