import * as fs from 'fs';
import * as path from 'path';
import {makeTmpDir, runCli, writeFileEnsuringDir} from './common';

const TEMPLATE_CONFIG = [
  'version: 1',
  'templates:',
  '  global:',
  '    pinned-keys: [domain, category]',
  '    key-order: [domain, category, status, aliases]',
  '    frontmatter:',
  '      domain: general',
  '      status: NEW',
  '      aliases: []',
  '    body: "# {{title}}"',
  '  by-scope:',
  '    - name: projects',
  '      match:',
  '        path: ["Projects/**"]',
  '      toggles:',
  '        aliases: off',
  '      frontmatter:',
  '        domain: product',
  '',
].join('\n');

function setup(): string {
  const dir = makeTmpDir('lappe-tmpl-');
  fs.writeFileSync(path.join(dir, 'linter.yaml'), TEMPLATE_CONFIG);
  return dir;
}

describe('template list', () => {
  it('lists the global base and scoped templates', async () => {
    const dir = setup();
    const {code, out} = await runCli(['template', 'list'], dir);
    expect(code).toBe(0);
    expect(out).toContain('GLOBAL');
    expect(out).toContain('pinned: domain, category');
    expect(out).toContain('SCOPED  projects');
    expect(out).toContain('path:Projects/**');
    expect(out).toContain('toggles: aliases=off');
  });

  it('reports when no templates are configured', async () => {
    const dir = makeTmpDir('lappe-tmpl-');
    fs.writeFileSync(path.join(dir, 'linter.yaml'), 'version: 1\n');
    const {code, out} = await runCli(['template', 'list'], dir);
    expect(code).toBe(0);
    expect(out).toContain('no templates configured');
  });
});

describe('template show', () => {
  it('renders the effective scoped template', async () => {
    const dir = setup();
    const {code, out} = await runCli(['template', 'show', 'projects', '--today', '2026-07-17'], dir);
    expect(code).toBe(0);
    expect(out).toContain('chain: global -> projects');
    // scoped domain overrides global; aliases toggled off
    expect(out).toContain('domain: product');
    expect(out).not.toContain('aliases:');
  });

  it('errors on an unknown template', async () => {
    const dir = setup();
    const {code, err} = await runCli(['template', 'show', 'nope'], dir);
    expect(code).toBe(2);
    expect(err).toContain('unknown template "nope"');
  });
});

describe('template apply', () => {
  it('scaffolds a new note from the matching template', async () => {
    const dir = setup();
    const {code, out} = await runCli(['template', 'apply', 'Projects/new-thing.md', '--today', '2026-07-17'], dir);
    expect(code).toBe(0);
    expect(out).toContain('wrote Projects/new-thing.md from template projects');
    const written = fs.readFileSync(path.join(dir, 'Projects/new-thing.md'), 'utf8');
    expect(written).toContain('domain: product');
    expect(written).toContain('# new-thing');
    expect(written).not.toContain('aliases:');
  });

  it('never overwrites an existing note; previews instead', async () => {
    const dir = setup();
    writeFileEnsuringDir(path.join(dir, 'Projects/existing.md'), 'original content\n');
    const {code, out} = await runCli(['template', 'apply', 'Projects/existing.md'], dir);
    expect(code).toBe(0);
    expect(out).toContain('exists; preview only, not overwritten');
    expect(fs.readFileSync(path.join(dir, 'Projects/existing.md'), 'utf8')).toBe('original content\n');
  });

  it('dry-run prints without writing', async () => {
    const dir = setup();
    const {code, out} = await runCli(['template', 'apply', 'Projects/preview.md', '--dry-run'], dir);
    expect(code).toBe(0);
    expect(out).toContain('new; dry-run');
    expect(fs.existsSync(path.join(dir, 'Projects/preview.md'))).toBe(false);
  });
});

const ENFORCE_CONFIG = [
  'version: 1',
  'templates:',
  '  global:',
  '    pinned-keys: [domain, category]',
  '    frontmatter:',
  '      domain: general',
  '      category: general',
  '  by-scope:',
  '    - name: projects',
  '      match:',
  '        path: ["Projects/**"]',
  '      frontmatter:',
  '        domain: product',
  '',
].join('\n');

function enforceSetup(): string {
  const dir = makeTmpDir('lappe-enf-');
  fs.writeFileSync(path.join(dir, 'linter.yaml'), ENFORCE_CONFIG);
  return dir;
}

describe('template apply --enforce (DEC-104)', () => {
  it('writes missing pinned keys into an existing matched note, preserving the rest', async () => {
    const dir = enforceSetup();
    writeFileEnsuringDir(path.join(dir, 'Projects/thin.md'), '---\ndomain: product\ntitle: Keep me\n---\n\nBody stays.\n');
    const {code, out} = await runCli(['template', 'apply', 'Projects/thin.md', '--enforce'], dir);
    expect(code).toBe(0);
    expect(out).toContain('enforced Projects/thin.md: added pinned keys category');
    const written = fs.readFileSync(path.join(dir, 'Projects/thin.md'), 'utf8');
    expect(written).toContain('category: general');
    expect(written).toContain('domain: product'); // existing value untouched
    expect(written).toContain('title: Keep me'); // non-pinned key preserved
    expect(written).toContain('Body stays.'); // body preserved
  });

  it('does not overwrite a pinned key the note already sets', async () => {
    const dir = enforceSetup();
    writeFileEnsuringDir(path.join(dir, 'Projects/full.md'), '---\ndomain: mine\ncategory: mine\n---\n\nx\n');
    const {code, out} = await runCli(['template', 'apply', 'Projects/full.md', '--enforce'], dir);
    expect(code).toBe(0);
    expect(out).toContain('already conforms');
    expect(fs.readFileSync(path.join(dir, 'Projects/full.md'), 'utf8')).toContain('domain: mine');
  });

  it('enforce --dry-run reports without writing', async () => {
    const dir = enforceSetup();
    writeFileEnsuringDir(path.join(dir, 'Projects/thin.md'), '---\ndomain: product\n---\n\nx\n');
    const {code, out} = await runCli(['template', 'apply', 'Projects/thin.md', '--enforce', '--dry-run'], dir);
    expect(code).toBe(0);
    expect(out).toContain('would add category');
    expect(fs.readFileSync(path.join(dir, 'Projects/thin.md'), 'utf8')).not.toContain('category:');
  });

  it('bare apply still previews an existing note (no --enforce)', async () => {
    const dir = enforceSetup();
    writeFileEnsuringDir(path.join(dir, 'Projects/thin.md'), '---\ndomain: product\n---\n\nx\n');
    const {out} = await runCli(['template', 'apply', 'Projects/thin.md'], dir);
    expect(out).toContain('preview only, not overwritten');
    expect(fs.readFileSync(path.join(dir, 'Projects/thin.md'), 'utf8')).not.toContain('category:');
  });
});

describe('template check', () => {
  it('flags a note missing its template pinned keys', async () => {
    const dir = setup();
    writeFileEnsuringDir(path.join(dir, 'Projects/thin.md'), '---\ndomain: product\n---\n\nbody\n');
    const {code, out} = await runCli(['template', 'check', 'Projects/thin.md'], dir);
    expect(code).toBe(1);
    expect(out).toContain('missing pinned keys category');
  });

  it('passes a conforming note', async () => {
    const dir = setup();
    writeFileEnsuringDir(path.join(dir, 'Projects/full.md'), '---\ndomain: product\ncategory: x\n---\n\nbody\n');
    const {code} = await runCli(['template', 'check', 'Projects/full.md'], dir);
    expect(code).toBe(0);
  });
});
