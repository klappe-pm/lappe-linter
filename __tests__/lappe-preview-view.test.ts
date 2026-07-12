import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const source = readFileSync(resolve(__dirname, '../src/ui/lappe-preview-view.ts'), 'utf8');

describe('workspace preview contract', () => {
  it('uses a registered ItemView and renders Markdown beside settings', () => {
    expect(source).toContain('extends ItemView');
    expect(source).toContain('MarkdownRenderer.render');
    expect(source).toContain('Current settings');
    expect(source).toContain('gridTemplateColumns');
    expect(source).not.toContain('extends Modal');
  });
});
