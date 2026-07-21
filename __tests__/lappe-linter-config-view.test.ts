import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  DEFAULT_LINTER_PREVIEW_SETTINGS,
  applyLinterConfig,
  mergeLinterPreviewSettings,
  renderConfigPreview,
  ruleExecutionOrder,
} from '../src/lappe/linter-config-core';

describe('linter config core renders from defaults (out of the box)', () => {
  it('base mode emits a frontmatter note from the default base template', () => {
    const out = renderConfigPreview({mode: 'base', settings: DEFAULT_LINTER_PREVIEW_SETTINGS, today: '2026-07-21'});
    expect(out.startsWith('---')).toBe(true);
    expect(out).toContain('domain: product');
    expect(out).toContain('category: strategy');
    expect(out).toContain('> age:');
  });

  it('linter mode formats the synthetic note with the default rule set', () => {
    const out = renderConfigPreview({mode: 'linter', settings: DEFAULT_LINTER_PREVIEW_SETTINGS, today: '2026-07-21'});
    // Default bold=normalize converts __x__ to **x**; underscore=convert-to-asterisk.
    expect(out).not.toContain('__');
    // H1 default is Title Case: "north star" -> "North Star" (markers preserved).
    expect(out).toMatch(/# .*North Star/);
  });

  it('applyLinterConfig removes highlight markers when highlight=remove', () => {
    const settings = mergeLinterPreviewSettings(undefined);
    settings.linter.highlight = 'remove';
    const out = applyLinterConfig('# heading\n\n==marked== text\n', settings.linter);
    expect(out).not.toContain('==');
    expect(out).toContain('marked');
  });

  it('ruleExecutionOrder pins the locked rules first', () => {
    const order = ruleExecutionOrder(DEFAULT_LINTER_PREVIEW_SETTINGS.linter);
    expect(order.slice(0, 6)).toEqual([
      'emphasis', 'heading-casing', 'heading-spacing', 'paragraph-spacing', 'list-spacing', 'wrapping',
    ]);
  });

  it('mergeLinterPreviewSettings deep-seeds defaults over a partial blob', () => {
    const merged = mergeLinterPreviewSettings({baseTemplate: {domain: 'custom'} as never});
    expect(merged.baseTemplate.domain).toBe('custom');
    // Missing nested fields fall back to defaults rather than becoming undefined.
    expect(merged.baseTemplate.category).toBe('strategy');
    expect(merged.linter.headingCaseByLevel[1]).toBe('Title Case');
  });
});

describe('linter config view is a registered workspace view', () => {
  const source = readFileSync(resolve(__dirname, '../src/ui/linter-config-view.ts'), 'utf8');
  it('extends ItemView with linter and base tabs, driven by settings', () => {
    expect(source).toContain('extends ItemView');
    expect(source).toContain("LINTER_CONFIG_VIEW_TYPE = 'lappe-linter-config'");
    expect(source).toContain('Linter rules');
    expect(source).toContain('Base template');
    expect(source).toContain('settings.linterConfigPreview');
    expect(source).toContain('renderConfigPreview');
  });
});
