import {
  CANONICAL_CONFIG_FILENAME,
  CONFIG_FILENAME_ALIASES,
  parseLinterConfig,
} from '../../src/config/loader';

const VALID_FULL = `
version: 1
defaults:
  rules:
    yaml-key-sort:
      enabled: true
      priority-keys: [domain, category, sub-category, date-created, date-revised]
profiles:
  tasks-notes:
    match:
      path: ["tasks/**"]
      extension: [md]
      frontmatter: {category: task, priority: [high, low]}
      tag: [task]
    rules:
      yaml-key-sort:
        enabled: false
note-types:
  task:
    required:
      domain: development
      status: null
    key-order: [domain, category, status]
    values:
      status: [NEW, DRAFT, DONE]
    date-keys:
      created: date-created
      revised: date-revised
    match:
      frontmatter: {category: task}
rename:
  mode: flag
ignore:
  folders: [templates]
  files: [inbox/scratch.md]
providers:
  my-provider:
    rules:
      custom-rule:
        enabled: true
`;

describe('parseLinterConfig: valid configs', () => {
  it('accepts a full config with every section', () => {
    const result = parseLinterConfig(VALID_FULL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.config.version).toBe(1);
    expect(result.config.defaults?.rules?.['yaml-key-sort']?.enabled).toBe(true);
    expect(result.config.profiles?.['tasks-notes']?.match?.frontmatter?.category).toBe('task');
    expect(result.config['note-types']?.task?.['key-order']).toEqual(['domain', 'category', 'status']);
    expect(result.config.rename?.mode).toBe('flag');
    expect(result.config.ignore?.folders).toEqual(['templates']);
    expect(result.config.providers?.['my-provider']?.rules?.['custom-rule']?.enabled).toBe(true);
  });

  it('accepts a partial config with only the required version', () => {
    const result = parseLinterConfig('version: 1\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.config).toEqual({version: 1});
  });

  it('accepts empty sections', () => {
    const result = parseLinterConfig('version: 1\nprofiles: {}\nnote-types: {}\n');
    expect(result.ok).toBe(true);
  });
});

describe('parseLinterConfig: unknown keys', () => {
  it('warns on unknown top-level keys without failing', () => {
    const result = parseLinterConfig('version: 1\nfuture-section: true\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('future-section');
    expect((result.config as Record<string, unknown>)['future-section']).toBe(true);
  });

  it('warns on unknown nested keys in known sections', () => {
    const result = parseLinterConfig('version: 1\nrename:\n  mode: off\n  extra: 1\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((w) => w.includes('rename.extra'))).toBe(true);
  });
});

describe('parseLinterConfig: fail closed', () => {
  it('rejects a wrong version', () => {
    const result = parseLinterConfig('version: 2\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([{path: 'version', message: 'must be 1'}]);
  });

  it('rejects a missing version', () => {
    const result = parseLinterConfig('defaults: {}\n');
    expect(result.ok).toBe(false);
  });

  it('rejects yaml that is not a mapping', () => {
    for (const text of ['', '- a\n- b\n', '42\n']) {
      const result = parseLinterConfig(text);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0].message).toContain('mapping');
    }
  });

  it('rejects malformed yaml with a parse error', () => {
    const result = parseLinterConfig('version: 1\n  bad-indent: [\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain('yaml parse error');
  });

  it('reports every structural error, not just the first', () => {
    const broken = `
version: 2
defaults:
  rules:
    yaml-key-sort: not-a-mapping
profiles:
  bad:
    match:
      path: docs
rename:
  mode: sometimes
ignore:
  folders: [1, 2]
`;
    const result = parseLinterConfig(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('version');
    expect(paths).toContain('defaults.rules.yaml-key-sort');
    expect(paths).toContain('profiles.bad.match.path');
    expect(paths).toContain('rename.mode');
    expect(paths).toContain('ignore.folders');
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });

  it('never returns a partial config on error', () => {
    const result = parseLinterConfig('version: 1\nrename:\n  mode: sometimes\n');
    expect(result.ok).toBe(false);
    expect('config' in result).toBe(false);
  });

  it('rejects a non-boolean enabled', () => {
    const result = parseLinterConfig('version: 1\ndefaults:\n  rules:\n    x:\n      enabled: "yes"\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].path).toBe('defaults.rules.x.enabled');
  });

  it('rejects bad note-type schemas with precise paths', () => {
    const result = parseLinterConfig(`
version: 1
note-types:
  task:
    key-order: nope
    values:
      status: {a: 1}
    date-keys:
      created: 5
`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('note-types.task.key-order');
    expect(paths).toContain('note-types.task.values.status');
    expect(paths).toContain('note-types.task.date-keys.created');
  });
});

describe('config filename contract (dec-002)', () => {
  it('exposes linter.yaml as canonical and lappe-linter.yaml as alias', () => {
    expect(CANONICAL_CONFIG_FILENAME).toBe('linter.yaml');
    expect(CONFIG_FILENAME_ALIASES[0]).toBe('linter.yaml');
    expect(CONFIG_FILENAME_ALIASES).toContain('lappe-linter.yaml');
  });
});
