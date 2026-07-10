import * as fs from 'fs';
import * as path from 'path';
import {BASIC_CONFIG, EM_DASH, makeTmpDir, runCli} from './common';

describe('--json output contract (output-version 1, R5)', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpDir('lappe-cli-json-');
    fs.writeFileSync(path.join(dir, 'linter.yaml'), BASIC_CONFIG);
  });

  it('emits one JSON line per file with the versioned schema', async () => {
    fs.writeFileSync(path.join(dir, 'bad.md'), `Alpha${EM_DASH}beta **bold**.\n`);
    fs.writeFileSync(path.join(dir, 'clean.md'), 'Nothing here.\n');
    const result = await runCli(['check', 'bad.md', 'clean.md', '--json', '--today', '2026-07-10'], dir);
    expect(result.code).toBe(1);

    const lines = result.out.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    const [bad, clean] = lines.map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(Object.keys(bad as object)).toEqual(['path', 'profile', 'violations', 'renamed_to', 'output-version']);
    expect(bad['path']).toBe('bad.md');
    expect(bad['profile']).toBe('defaults');
    expect(bad['renamed_to']).toBeNull();
    expect(bad['output-version']).toBe(1);
    const violations = bad['violations'] as Array<Record<string, unknown>>;
    expect(violations.map((v) => Object.keys(v))).toEqual(
      violations.map(() => ['rule', 'line', 'message', 'fixed']),
    );
    expect(violations.map((v) => v['rule']).sort()).toEqual(['replace-em-dash', 'strip-strong']);

    expect(clean['violations']).toEqual([]);
    expect(clean['path']).toBe('clean.md');

    expect(lines.join('\n')).toMatchSnapshot();
  });

  it('fix --json reports renamed_to under --allow-rename with rename.mode rename', async () => {
    fs.writeFileSync(
      path.join(dir, 'linter.yaml'),
      [
        'version: 1',
        'defaults:',
        '  rules:',
        '    kebab-case-filename:',
        '      enabled: true',
        'rename:',
        '  mode: rename',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(path.join(dir, 'My Note.md'), 'Body.\n');

    const flagged = await runCli(['fix', 'My Note.md', '--json'], dir);
    expect(flagged.code).toBe(0);
    const flaggedLine = JSON.parse(flagged.out.trimEnd()) as Record<string, unknown>;
    expect(flaggedLine['renamed_to']).toBeNull();
    expect(fs.existsSync(path.join(dir, 'My Note.md'))).toBe(true);

    const renamed = await runCli(['fix', 'My Note.md', '--json', '--allow-rename'], dir);
    expect(renamed.code).toBe(0);
    const renamedLine = JSON.parse(renamed.out.trimEnd()) as Record<string, unknown>;
    expect(renamedLine['renamed_to']).toBe('my-note.md');
    expect(fs.existsSync(path.join(dir, 'my-note.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'My Note.md'))).toBe(false);
  });
});
