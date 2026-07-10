import * as fs from 'fs';
import * as path from 'path';
import {parseLinterConfig} from '@lappe-linter/core';
import {makeTmpDir, runCli} from './common';

describe('init', () => {
  it('writes a parseable starter linter.yaml', async () => {
    const dir = makeTmpDir('lappe-cli-init-');
    const result = await runCli(['init'], dir);
    expect(result.code).toBe(0);
    expect(result.out).toBe('wrote linter.yaml\n');
    const text = fs.readFileSync(path.join(dir, 'linter.yaml'), 'utf8');
    const parsed = parseLinterConfig(text);
    expect(parsed.ok).toBe(true);
  });

  it('is idempotent: never overwrites an existing linter.yaml', async () => {
    const dir = makeTmpDir('lappe-cli-init-');
    const existing = 'version: 1\ndefaults:\n  rules: {}\n# my customizations\n';
    fs.writeFileSync(path.join(dir, 'linter.yaml'), existing);
    const result = await runCli(['init'], dir);
    expect(result.code).toBe(0);
    expect(result.out).toContain('already exists');
    expect(fs.readFileSync(path.join(dir, 'linter.yaml'), 'utf8')).toBe(existing);
  });

  it('rejects extra paths', async () => {
    const dir = makeTmpDir('lappe-cli-init-');
    const result = await runCli(['init', 'somewhere'], dir);
    expect(result.code).toBe(2);
  });
});
