import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');
const lappeTab = read('../src/ui/linter-components/tab-components/lappe-tab.ts');
const generalTab = read('../src/ui/linter-components/tab-components/general-tab.ts');
const configService = read('../src/lappe/config-service.ts');

// Gap #2: the scope-type selector is a multi-select dropdown that reveals a
// field per selected type and closes when the user clicks outside it, replacing
// the always-visible checkbox grid.
describe('scope-type multi-select dropdown', () => {
  it('renders a dropdown menu, not a checkbox grid', () => {
    expect(lappeTab).toContain('lappe-scope-picker-menu');
    expect(lappeTab).toContain('lappe-scope-picker-trigger');
    // The old grid built raw checkbox inputs for every scope type.
    expect(lappeTab).not.toContain('label.createEl(\'input\', {type: \'checkbox\'})');
  });

  it('closes the menu on an outside click', () => {
    expect(lappeTab).toContain('document.addEventListener(\'click\'');
    expect(lappeTab).toContain('picker.contains(event.target as Node)');
    expect(lappeTab).toContain('document.removeEventListener(\'click\'');
  });

  it('still reveals a value field per selected type', () => {
    expect(lappeTab).toContain('renderField(scope.key)');
  });
});

// Gap #5: per-scope rule ordering, backed by profiles.<name>.rule-order, which
// the core resolver honors.
describe('per-scope rule ordering', () => {
  it('the config service reads and writes a profile rule order', () => {
    expect(configService).toContain('profileRuleOrder(name: string)');
    expect(configService).toContain('async setProfileRuleOrder(name: string, order: string[])');
    // Empty clears the override so the scope relinks to the global order.
    expect(configService).toContain('doc.deleteIn([\'profiles\', name, \'rule-order\'])');
    expect(configService).toContain('doc.setIn([\'profiles\', name, \'rule-order\'], order)');
  });

  it('every profile gets an order editor with a relink-to-global action', () => {
    expect(lappeTab).toContain('renderProfileRuleOrder(profileEl, name)');
    expect(lappeTab).toContain('setProfileRuleOrder');
    expect(lappeTab).toContain('Use the global order for this scope');
  });
});

// Gap #6: the legacy "YAML Common Style" cluster is no longer surfaced in the
// General tab; the dedicated YAML tab is the single YAML surface.
describe('legacy common-style controls removed', () => {
  it('the General tab no longer exposes the common-style YAML controls', () => {
    expect(generalTab).not.toContain('commonStyles.aliasArrayStyle');
    expect(generalTab).not.toContain('commonStyles.tagArrayStyle');
    expect(generalTab).not.toContain('commonStyles.escapeCharacter');
  });

  it('keeps the genuine general settings', () => {
    expect(generalTab).toContain('\'lintOnSave\'');
    expect(generalTab).toContain('FolderIgnoreOption');
  });
});
