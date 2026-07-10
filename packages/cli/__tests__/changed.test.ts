import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {BASIC_CONFIG, EM_DASH, makeTmpDir, runCli} from './common';

function git(dir: string, args: string[]): void {
  execFileSync('git', args, {
    cwd: dir,
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
    stdio: 'pipe',
  });
}

describe('--changed git scoping', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.realpathSync(makeTmpDir('lappe-cli-changed-'));
    git(dir, ['init', '-q']);
    fs.writeFileSync(path.join(dir, 'linter.yaml'), BASIC_CONFIG);
    fs.writeFileSync(path.join(dir, 'modified.md'), 'Committed clean.\n');
    fs.writeFileSync(path.join(dir, 'untouched.md'), `Committed${EM_DASH}dirty but unchanged.\n`);
    fs.writeFileSync(path.join(dir, 'note.txt'), 'Not markdown.\n');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-q', '-m', 'seed']);
  });

  it('targets modified and staged .md files only', async () => {
    fs.writeFileSync(path.join(dir, 'modified.md'), `Now${EM_DASH}violating.\n`);
    fs.writeFileSync(path.join(dir, 'staged-new.md'), `Staged${EM_DASH}violating.\n`);
    git(dir, ['add', 'staged-new.md']);
    fs.writeFileSync(path.join(dir, 'note.txt'), `Changed${EM_DASH}but not markdown.\n`);

    const result = await runCli(['check', '--changed', '--json'], dir);
    expect(result.code).toBe(1);
    const paths = result.out
      .trimEnd()
      .split('\n')
      .map((line) => (JSON.parse(line) as {path: string}).path)
      .sort();
    expect(paths).toEqual(['modified.md', 'staged-new.md']);
  });

  it('exits 0 when no .md files changed', async () => {
    fs.writeFileSync(path.join(dir, 'note.txt'), 'Different text.\n');
    const result = await runCli(['check', '--changed'], dir);
    expect(result.code).toBe(0);
    expect(result.out).toBe('');
  });

  it('fix --changed applies fixes to the changed files', async () => {
    fs.writeFileSync(path.join(dir, 'modified.md'), `Now${EM_DASH}violating.\n`);
    const result = await runCli(['fix', '--changed'], dir);
    expect(result.code).toBe(0);
    expect(result.out).toBe('modified.md\n');
    expect(fs.readFileSync(path.join(dir, 'modified.md'), 'utf8')).toBe('Now, violating.\n');
    expect(fs.readFileSync(path.join(dir, 'untouched.md'), 'utf8')).toBe(
      `Committed${EM_DASH}dirty but unchanged.\n`,
    );
  });

  // SEC-004 regression: with core.quotePath=true (git default) a non-ASCII or
  // quote-carrying path is emitted C-quoted by plain --name-only, fails the
  // .md filter, and silently escapes the pre-commit lint gate. -z output must
  // keep such files in scope.
  it('targets changed .md files whose names git would quote', async () => {
    const unicodeName = 'нотатка.md';
    const quoteName = 'we"ird.md';
    fs.writeFileSync(path.join(dir, unicodeName), `Unicode${EM_DASH}violating.\n`);
    fs.writeFileSync(path.join(dir, quoteName), `Quoted${EM_DASH}violating.\n`);
    git(dir, ['add', unicodeName, quoteName]);

    const result = await runCli(['check', '--changed', '--json'], dir);
    expect(result.code).toBe(1);
    const paths = result.out
      .trimEnd()
      .split('\n')
      .map((line) => (JSON.parse(line) as {path: string}).path)
      .sort();
    expect(paths).toEqual([quoteName, unicodeName].sort());
  });

  it('exits 2 outside a git repository', async () => {
    const bare = makeTmpDir('lappe-cli-nogit-');
    fs.writeFileSync(path.join(bare, 'linter.yaml'), BASIC_CONFIG);
    const result = await runCli(['check', '--changed'], bare);
    expect(result.code).toBe(2);
    expect(result.err).toContain('--changed requires a git repository');
  });
});
