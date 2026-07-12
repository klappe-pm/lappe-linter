import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const settingsSource = readFileSync(resolve(__dirname, '../src/ui/settings.ts'), 'utf8');
const tabSource = readFileSync(resolve(__dirname, '../src/ui/linter-components/tab-components/tab.ts'), 'utf8');

describe('canonical settings navigation', () => {
  it('registers the requested surfaces as separate tabs', () => {
    for (const name of ['YAML', 'Headers', 'Body', 'Special formatting', 'Scopes', 'Rule order']) {
      expect(settingsSource).toContain(`'${name}'`);
    }
    expect(settingsSource).not.toContain('\'Lappe\'');
    expect(settingsSource).not.toContain('\'Style\'');
  });

  it('does not retain the removed Lappe or Style navigation mappings', () => {
    expect(tabSource).not.toContain('\'Lappe\':');
    expect(tabSource).not.toContain('\'Style\':');
    expect(tabSource).toContain('\'Special formatting\':');
    expect(tabSource).toContain('\'Rule order\':');
  });
});
