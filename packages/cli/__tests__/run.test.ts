import * as fs from 'fs';
import * as path from 'path';
import {EM_DASH, makeTmpDir, runCli} from './common';

const AUTOMATION_CONFIG = [
  'version: 1',
  'defaults:',
  '  rules:',
  '    replace-em-dash:',
  '      enabled: true',
  'automations:',
  '  - name: lint-on-write',
  '    trigger: on-write',
  '    action: fix',
  '    failure: open',
  '  - name: gate',
  '    trigger: pre-commit',
  '    action: check',
  '    failure: closed',
  '',
].join('\n');

function setup(): string {
  const dir = makeTmpDir('lappe-run-');
  fs.writeFileSync(path.join(dir, 'linter.yaml'), AUTOMATION_CONFIG);
  return dir;
}

describe('run --list', () => {
  it('lists configured automations with their failure mode', async () => {
    const dir = setup();
    const {code, out} = await runCli(['run', '--list'], dir);
    expect(code).toBe(0);
    expect(out).toContain('lint-on-write   trigger:on-write   action:fix   failure:open');
    expect(out).toContain('gate   trigger:pre-commit   action:check   failure:closed');
  });
});

describe('run <name>', () => {
  it('fires a fix automation over the given paths', async () => {
    const dir = setup();
    fs.writeFileSync(path.join(dir, 'note.md'), `Alpha${EM_DASH}beta.\n`);
    const {code} = await runCli(['run', 'lint-on-write', 'note.md'], dir);
    expect(code).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'note.md'), 'utf8')).toBe('Alpha, beta.\n');
  });

  it('an open automation never blocks even when a check finds violations', async () => {
    const dir = makeTmpDir('lappe-run-');
    fs.writeFileSync(path.join(dir, 'linter.yaml'), [
      'version: 1',
      'defaults:',
      '  rules:',
      '    replace-em-dash:',
      '      enabled: true',
      'automations:',
      '  - name: soft',
      '    trigger: on-write',
      '    action: check',
      '    failure: open',
      '',
    ].join('\n'));
    fs.writeFileSync(path.join(dir, 'note.md'), `Alpha${EM_DASH}beta.\n`);
    const {code, out} = await runCli(['run', 'soft', 'note.md'], dir);
    expect(out).toContain('replace-em-dash');
    expect(code).toBe(0); // open: reports but does not block
  });

  it('a closed gate surfaces the non-zero exit on violations', async () => {
    const dir = setup();
    fs.writeFileSync(path.join(dir, 'note.md'), `Alpha${EM_DASH}beta.\n`);
    const {code} = await runCli(['run', 'gate', 'note.md'], dir);
    expect(code).toBe(1);
  });

  it('errors on an unknown automation', async () => {
    const dir = setup();
    const {code, err} = await runCli(['run', 'ghost', 'note.md'], dir);
    expect(code).toBe(2);
    expect(err).toContain('no automation named "ghost"');
  });
});
