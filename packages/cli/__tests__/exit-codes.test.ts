import * as fs from 'fs';
import * as path from 'path';
import {BASIC_CONFIG, EM_DASH, makeTmpDir, runCli, writeFileEnsuringDir} from './common';

describe('exit code matrix (R4)', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpDir('lappe-cli-exit-');
    fs.writeFileSync(path.join(dir, 'linter.yaml'), BASIC_CONFIG);
  });

  it('check on a clean file exits 0', async () => {
    fs.writeFileSync(path.join(dir, 'clean.md'), 'Nothing to fix here.\n');
    const result = await runCli(['check', 'clean.md'], dir);
    expect(result.code).toBe(0);
    expect(result.out).toBe('');
  });

  it('check on a violating file exits 1 and names the rule', async () => {
    fs.writeFileSync(path.join(dir, 'bad.md'), `Alpha${EM_DASH}beta.\n`);
    const result = await runCli(['check', 'bad.md'], dir);
    expect(result.code).toBe(1);
    expect(result.out).toContain('bad.md: replace-em-dash:');
  });

  it('fix on a violating file exits 0, prints the changed file, and is idempotent', async () => {
    const file = path.join(dir, 'bad.md');
    fs.writeFileSync(file, `Alpha${EM_DASH}beta and **bold**.\n`);
    const first = await runCli(['fix', 'bad.md'], dir);
    expect(first.code).toBe(0);
    expect(first.out).toBe('bad.md\n');
    const afterFirst = fs.readFileSync(file, 'utf8');
    expect(afterFirst).toBe('Alpha, beta and bold.\n');

    const second = await runCli(['fix', 'bad.md'], dir);
    expect(second.code).toBe(0);
    expect(second.out).toBe('');
    expect(fs.readFileSync(file, 'utf8')).toBe(afterFirst);

    const check = await runCli(['check', 'bad.md'], dir);
    expect(check.code).toBe(0);
  });

  it('invalid config fails closed with loader errors on stderr and exit 2', async () => {
    fs.writeFileSync(path.join(dir, 'linter.yaml'), 'version: 2\ndefaults: []\n');
    fs.writeFileSync(path.join(dir, 'bad.md'), `Alpha${EM_DASH}beta.\n`);
    const result = await runCli(['check', 'bad.md'], dir);
    expect(result.code).toBe(2);
    expect(result.err).toContain('version: must be 1');
    expect(result.err).toContain('defaults: must be a mapping');
    expect(result.out).toBe('');
  });

  it('missing target path exits 2', async () => {
    const result = await runCli(['check', 'does-not-exist.md'], dir);
    expect(result.code).toBe(2);
    expect(result.err).toContain('no such file or directory');
  });

  it('unknown command exits 2', async () => {
    const result = await runCli(['frobnicate', 'x.md'], dir);
    expect(result.code).toBe(2);
    expect(result.err).toContain('unknown command');
  });

  it('unknown flag exits 2', async () => {
    const result = await runCli(['check', 'clean.md', '--wat'], dir);
    expect(result.code).toBe(2);
    expect(result.err).toContain('unknown flag');
  });

  it('check with no paths and no --changed exits 2', async () => {
    const result = await runCli(['check'], dir);
    expect(result.code).toBe(2);
    expect(result.err).toContain('check requires at least one path');
  });

  it('files under ignore folders are skipped entirely', async () => {
    fs.writeFileSync(
        path.join(dir, 'linter.yaml'),
        `${BASIC_CONFIG}ignore:\n  folders: [templates]\n  files: [scratch.md]\n`,
    );
    writeFileEnsuringDir(path.join(dir, 'templates', 'tpl.md'), `Alpha${EM_DASH}beta.\n`);
    fs.writeFileSync(path.join(dir, 'scratch.md'), `Alpha${EM_DASH}beta.\n`);
    const result = await runCli(['check', 'templates/tpl.md', 'scratch.md', '--json'], dir);
    expect(result.code).toBe(0);
    expect(result.out).toBe('');

    const fix = await runCli(['fix', 'templates/tpl.md', 'scratch.md'], dir);
    expect(fix.code).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'templates', 'tpl.md'), 'utf8')).toBe(`Alpha${EM_DASH}beta.\n`);
  });

  it('directory targets recurse into .md files only', async () => {
    writeFileEnsuringDir(path.join(dir, 'docs', 'a.md'), `Alpha${EM_DASH}beta.\n`);
    writeFileEnsuringDir(path.join(dir, 'docs', 'b.txt'), `Alpha${EM_DASH}beta.\n`);
    const result = await runCli(['check', 'docs'], dir);
    expect(result.code).toBe(1);
    expect(result.out).toContain('docs/a.md');
    expect(result.out).not.toContain('b.txt');
  });

  it('--version exits 0 and prints a semver', async () => {
    const result = await runCli(['--version'], dir);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/^\d+\.\d+\.\d+\n$/);
  });
});
