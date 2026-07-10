import * as fs from 'fs';
import * as path from 'path';
import {BASIC_CONFIG, EM_DASH, makeTmpDir, runCli} from './common';

describe('fix --stdin filter mode', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpDir('lappe-cli-stdin-');
    fs.writeFileSync(path.join(dir, 'linter.yaml'), BASIC_CONFIG);
  });

  it('writes the fixed text to stdout and exits 0', async () => {
    const input = `Alpha${EM_DASH}beta and **bold**.\n`;
    const result = await runCli(['fix', '--stdin'], dir, input);
    expect(result.code).toBe(0);
    expect(result.out).toBe('Alpha, beta and bold.\n');
  });

  it('passes clean input through byte-identically', async () => {
    const input = 'Already clean.\n';
    const result = await runCli(['fix', '--stdin'], dir, input);
    expect(result.code).toBe(0);
    expect(result.out).toBe(input);
  });

  it('scope-resolves via --stdin-path', async () => {
    fs.writeFileSync(
        path.join(dir, 'linter.yaml'),
        [
          BASIC_CONFIG,
          'profiles:',
          '  raw:',
          '    match:',
          '      path: ["raw/**"]',
          '    rules:',
          '      replace-em-dash:',
          '        enabled: false',
          '      strip-strong:',
          '        enabled: false',
          '',
        ].join('\n'),
    );
    const input = `Alpha${EM_DASH}beta.\n`;
    const scoped = await runCli(['fix', '--stdin', '--stdin-path', 'raw/x.md'], dir, input);
    expect(scoped.code).toBe(0);
    expect(scoped.out).toBe(input);

    const unscoped = await runCli(['fix', '--stdin', '--stdin-path', 'other/x.md'], dir, input);
    expect(unscoped.out).toBe('Alpha, beta.\n');
  });

  it('echoes input unchanged and exits 2 on an invalid config', async () => {
    fs.writeFileSync(path.join(dir, 'linter.yaml'), 'version: 9\n');
    const input = `Alpha${EM_DASH}beta.\n`;
    const result = await runCli(['fix', '--stdin'], dir, input);
    expect(result.code).toBe(2);
    expect(result.out).toBe(input);
    expect(result.err).toContain('version: must be 1');
  });

  it('echoes input unchanged when the stdin path is ignored', async () => {
    fs.writeFileSync(path.join(dir, 'linter.yaml'), `${BASIC_CONFIG}ignore:\n  files: [stdin.md]\n`);
    const input = `Alpha${EM_DASH}beta.\n`;
    const result = await runCli(['fix', '--stdin'], dir, input);
    expect(result.code).toBe(0);
    expect(result.out).toBe(input);
  });

  it('rejects --stdin combined with paths', async () => {
    const result = await runCli(['fix', '--stdin', 'x.md'], dir, 'y\n');
    expect(result.code).toBe(2);
    expect(result.err).toContain('--stdin takes no paths');
  });
});
