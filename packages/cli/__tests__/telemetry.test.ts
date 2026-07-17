import * as fs from 'fs';
import * as path from 'path';
import {EM_DASH, makeTmpDir, runCli} from './common';

const TEMPLATE_CONFIG = [
  'version: 1',
  'templates:',
  '  global:',
  '    pinned-keys: [domain, category]',
  '    frontmatter:',
  '      domain: general',
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

const AUTOMATION_CONFIG = [
  'version: 1',
  'defaults:',
  '  rules:',
  '    replace-em-dash:',
  '      enabled: true',
  'automations:',
  '  - name: gate',
  '    trigger: pre-commit',
  '    action: check',
  '    failure: closed',
  '',
].join('\n');

describe('template apply --json emits template events', () => {
  it('emits one template-event JSONL line per path and suppresses human output', async () => {
    const dir = makeTmpDir('lappe-tel-');
    fs.writeFileSync(path.join(dir, 'linter.yaml'), TEMPLATE_CONFIG);
    const {code, out} = await runCli(
        ['template', 'apply', 'Projects/new.md', '--json', '--trigger', 'on-create', '--today', '2026-07-17'],
        dir,
    );
    expect(code).toBe(0);
    const lines = out.trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(1);
    const event = JSON.parse(lines[0]);
    expect(event).toMatchObject({
      kind: 'template',
      trigger: 'on-create',
      template: 'projects',
      scope_matched: ['path'],
      toggles_overridden: ['aliases'],
      mode: 'apply',
    });
    expect(event.keys_applied).toContain('domain');
    // the note was still written
    expect(fs.existsSync(path.join(dir, 'Projects/new.md'))).toBe(true);
    // no human "wrote ..." line leaked into the JSON stream
    expect(out).not.toContain('wrote Projects/new.md');
  });

  it('marks an existing note as preview mode', async () => {
    const dir = makeTmpDir('lappe-tel-');
    fs.writeFileSync(path.join(dir, 'linter.yaml'), TEMPLATE_CONFIG);
    fs.mkdirSync(path.join(dir, 'Projects'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'Projects/exists.md'), 'original\n');
    const {out} = await runCli(['template', 'apply', 'Projects/exists.md', '--json'], dir);
    const event = JSON.parse(out.trim());
    expect(event.mode).toBe('preview');
    expect(fs.readFileSync(path.join(dir, 'Projects/exists.md'), 'utf8')).toBe('original\n');
  });
});

describe('run --json emits a run summary', () => {
  it('appends a run-summary line with counts and honors the trigger', async () => {
    const dir = makeTmpDir('lappe-tel-');
    fs.writeFileSync(path.join(dir, 'linter.yaml'), AUTOMATION_CONFIG);
    fs.writeFileSync(path.join(dir, 'note.md'), `Alpha${EM_DASH}beta.\n`);
    const {code, out} = await runCli(['run', 'gate', 'note.md', '--json', '--trigger', 'pre-commit'], dir);
    expect(code).toBe(1); // closed gate, violations present
    const lines = out.trim().split('\n').filter(Boolean);
    const summary = JSON.parse(lines[lines.length - 1]);
    expect(summary).toMatchObject({
      kind: 'run',
      action: 'check',
      trigger: 'pre-commit',
      files_scanned: 1,
      exit_code: 1,
    });
    expect(summary.violations).toBeGreaterThan(0);
  });
});
