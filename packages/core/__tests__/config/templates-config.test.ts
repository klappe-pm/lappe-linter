import {parseLinterConfig} from '../../src/config/loader';

function parse(yaml: string) {
  return parseLinterConfig(`version: 1\n${yaml}`);
}

describe('templates config validation', () => {
  it('accepts a global base plus scoped children', () => {
    const result = parse(`
templates:
  global:
    pinned-keys: [domain, category]
    key-order: [domain, category, status]
    frontmatter:
      domain: general
      aliases: []
    body: "# {{title}}"
    age-line: true
  by-scope:
    - name: projects
      extends: global
      match:
        path: ["Projects/**"]
      toggles:
        aliases: off
      frontmatter:
        domain: product
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.templates?.global?.['pinned-keys']).toEqual(['domain', 'category']);
    expect(result.config.templates?.['by-scope']?.[0].name).toBe('projects');
  });

  it('rejects a by-scope that is not a list', () => {
    const result = parse('templates:\n  by-scope: {}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'templates.by-scope')).toBe(true);
  });

  it('rejects a scoped template with no name', () => {
    const result = parse('templates:\n  by-scope:\n    - match: {path: ["a/**"]}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'templates.by-scope[0].name')).toBe(true);
  });

  it('rejects duplicate scoped template names', () => {
    const result = parse('templates:\n  by-scope:\n    - name: dup\n    - name: dup');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes('duplicate template name'))).toBe(true);
  });

  it('warns on an unknown template key but still loads', () => {
    const result = parse('templates:\n  global:\n    bogus: 1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((w) => w.includes('templates.global.bogus'))).toBe(true);
  });
});

describe('automations config validation', () => {
  it('accepts well-formed automations', () => {
    const result = parse(`
automations:
  - name: lint-on-write
    trigger: on-write
    action: fix
    failure: open
    log: spool
  - name: nightly
    trigger: schedule
    schedule: "0 2 * * *"
    action: check
    report: md
    scope:
      path: ["**/*.md"]
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.automations?.length).toBe(2);
  });

  it('rejects an unknown trigger', () => {
    const result = parse('automations:\n  - name: x\n    trigger: whenever');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'automations[0].trigger')).toBe(true);
  });

  it('requires a cron string for a schedule trigger', () => {
    const result = parse('automations:\n  - name: x\n    trigger: schedule');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'automations[0].schedule')).toBe(true);
  });

  it('rejects automations that are not a list', () => {
    const result = parse('automations:\n  x: 1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === 'automations')).toBe(true);
  });
});
