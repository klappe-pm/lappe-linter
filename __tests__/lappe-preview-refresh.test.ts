import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const configService = readFileSync(resolve(__dirname, '../src/lappe/config-service.ts'), 'utf8');
const previewView = readFileSync(resolve(__dirname, '../src/ui/lappe-preview-view.ts'), 'utf8');

// Regression contract for the side-by-side preview refresh bug: UI edits in the
// Lappe tab persist through vault.adapter.write, which never emits the vault
// 'modify' event. A preview that refreshed only on 'modify' therefore went
// stale after every settings change. The fix routes refreshes through a config
// service change-observer that fires on every load().
describe('preview refresh wiring', () => {
  it('config service exposes a change observer', () => {
    expect(configService).toContain('onChange(listener: () => void)');
    expect(configService).toContain('private changeListeners = new Set<() => void>()');
    expect(configService).toContain('private notifyChange()');
  });

  it('every load() outcome notifies subscribers (valid and fail-closed)', () => {
    // notifyChange runs on the normal completion path and on the fail-closed
    // early return, so the preview reflects both good edits and broken configs.
    const notifyCount = (configService.match(/this\.notifyChange\(\)/g) ?? []).length;
    expect(notifyCount).toBeGreaterThanOrEqual(2);
  });

  it('preview subscribes to config changes, not the file-watcher', () => {
    expect(previewView).toContain('this.plugin.lappeConfig.onChange(');
    // The vault 'modify' listener was the stale path; it must be gone.
    expect(previewView).not.toContain('this.plugin.app.vault.on(\'modify\'');
  });
});
