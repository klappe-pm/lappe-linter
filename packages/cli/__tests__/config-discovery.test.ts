import * as fs from 'fs';
import * as path from 'path';
import {BASIC_CONFIG, EM_DASH, makeTmpDir, runCli, writeFileEnsuringDir} from './common';

const NOOP_CONFIG = 'version: 1\ndefaults:\n  rules: {}\n';

describe('config discovery', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpDir('lappe-cli-config-');
  });

  it('walks up from each target to the nearest config', async () => {
    fs.writeFileSync(path.join(dir, 'linter.yaml'), BASIC_CONFIG);
    writeFileEnsuringDir(path.join(dir, 'a', 'b', 'deep.md'), `Alpha${EM_DASH}beta.\n`);
    const result = await runCli(['check', 'a/b/deep.md'], dir);
    expect(result.code).toBe(1);
    expect(result.out).toContain('a/b/deep.md: replace-em-dash:');
  });

  it('a nested config shadows the root config for files under it', async () => {
    fs.writeFileSync(path.join(dir, 'linter.yaml'), BASIC_CONFIG);
    writeFileEnsuringDir(path.join(dir, 'sub', 'linter.yaml'), NOOP_CONFIG);
    writeFileEnsuringDir(path.join(dir, 'sub', 'inner.md'), `Alpha${EM_DASH}beta.\n`);
    fs.writeFileSync(path.join(dir, 'outer.md'), `Alpha${EM_DASH}beta.\n`);

    const inner = await runCli(['check', 'sub/inner.md'], dir);
    expect(inner.code).toBe(0);

    const outer = await runCli(['check', 'outer.md'], dir);
    expect(outer.code).toBe(1);

    const explain = await runCli(['explain', 'sub/inner.md'], dir);
    expect(explain.out).toContain(`config: ${path.join(dir, 'sub', 'linter.yaml')}`);
    expect(explain.out).toContain('path: inner.md');
  });

  it('linter.yaml beats lappe-linter.yaml in the same directory', async () => {
    fs.writeFileSync(path.join(dir, 'lappe-linter.yaml'), BASIC_CONFIG);
    fs.writeFileSync(path.join(dir, 'linter.yaml'), NOOP_CONFIG);
    fs.writeFileSync(path.join(dir, 'note.md'), `Alpha${EM_DASH}beta.\n`);

    const result = await runCli(['check', 'note.md'], dir);
    expect(result.code).toBe(0);

    const explain = await runCli(['explain', 'note.md'], dir);
    expect(explain.out).toContain(`config: ${path.join(dir, 'linter.yaml')}`);
  });

  it('lappe-linter.yaml is accepted when alone', async () => {
    fs.writeFileSync(path.join(dir, 'lappe-linter.yaml'), BASIC_CONFIG);
    fs.writeFileSync(path.join(dir, 'note.md'), `Alpha${EM_DASH}beta.\n`);
    const result = await runCli(['check', 'note.md'], dir);
    expect(result.code).toBe(1);
  });

  it('--config overrides discovery', async () => {
    fs.writeFileSync(path.join(dir, 'linter.yaml'), NOOP_CONFIG);
    fs.writeFileSync(path.join(dir, 'strict.yaml'), BASIC_CONFIG);
    fs.writeFileSync(path.join(dir, 'note.md'), `Alpha${EM_DASH}beta.\n`);
    const result = await runCli(['check', 'note.md', '--config', 'strict.yaml'], dir);
    expect(result.code).toBe(1);
  });

  it('explain shows the profile chain and note type', async () => {
    fs.writeFileSync(
      path.join(dir, 'linter.yaml'),
      [
        'version: 1',
        'defaults:',
        '  rules:',
        '    strip-strong:',
        '      enabled: true',
        'profiles:',
        '  tasks:',
        '    match:',
        '      frontmatter: {category: task}',
        '    rules:',
        '      strip-strong:',
        '        enabled: false',
        'note-types:',
        '  task:',
        '    match:',
        '      frontmatter: {category: task}',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(path.join(dir, 'todo.md'), '---\ncategory: task\n---\n\nBody.\n');
    const result = await runCli(['explain', 'todo.md'], dir);
    expect(result.code).toBe(0);
    expect(result.out).toContain('profile chain: defaults -> tasks');
    expect(result.out).toContain('note type: task');
    expect(result.out).toContain('strip-strong: disabled');
  });
});
