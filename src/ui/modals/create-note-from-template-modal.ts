import {App} from 'obsidian';
import {FormModal} from './form-modal';

/**
 * Prompt for the vault path of a new note to scaffold from a property template.
 * The path drives scope matching, so the modal shows which scoped templates
 * exist to help the author aim the note at one. Submitting hands the entered
 * path to the caller, which routes it through the DEC-104-safe create path.
 */
export class CreateNoteFromTemplateModal extends FormModal {
  private path = '';

  constructor(app: App, private scopedNames: string[], private onPath: (path: string) => void) {
    super(app);
    this.setCtaText('Create note');
    this.build();
  }

  private build(): void {
    this.titleEl.setText('Create note from template');
    this.addField((field) => {
      field.setName('New note path (vault-relative)');
      field.addText((text) => {
        text.setPlaceholder('Projects/example.md');
        text.onChange((value) => {
          this.path = value.trim();
        });
        text.inputEl.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            this.formSubmit();
          }
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });
      const hint = this.scopedNames.length > 0 ?
        `The path selects the scope. Scoped templates: ${this.scopedNames.join(', ')}.` :
        'Only the global base template is configured; every path uses it.';
      field.setHelp(hint);
    });
  }

  onSubmit(): void {
    if (this.path.length === 0) {
      return;
    }
    const path = this.path;
    this.close();
    this.onPath(path);
  }
}
