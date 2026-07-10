import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * --changed scoping (F06-T6): targets are the union of `git diff --name-only
 * HEAD` (worktree vs last commit, staged included) and `git diff --name-only
 * --cached` (staged-only, catches newly added files), filtered to .md files
 * that still exist on disk.
 */

export type ChangedResult = {ok: true; files: string[]} | {ok: false; message: string};

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {cwd, encoding: 'utf8'});
}

export function changedMarkdownFiles(cwd: string): ChangedResult {
  let root: string;
  try {
    root = git(['rev-parse', '--show-toplevel'], cwd).trim();
  } catch (err) {
    return {ok: false, message: `--changed requires a git repository: ${(err as Error).message}`};
  }

  // -z terminates entries with NUL and disables core.quotePath C-quoting, so
  // paths with newlines, quotes, or non-ASCII bytes arrive verbatim instead
  // of quoted (which would fail the .md filter and skip the file, letting it
  // bypass the pre-commit lint gate).
  const names = new Set<string>();
  try {
    for (const entry of git(['diff', '--name-only', '-z', 'HEAD'], cwd).split('\0')) {
      if (entry !== '') {
        names.add(entry);
      }
    }
  } catch {
    // No HEAD yet (fresh repository): fall through to the staged diff only.
  }
  try {
    for (const entry of git(['diff', '--name-only', '-z', '--cached'], cwd).split('\0')) {
      if (entry !== '') {
        names.add(entry);
      }
    }
  } catch (err) {
    return {ok: false, message: `git diff failed under --changed: ${(err as Error).message}`};
  }

  const files = [...names]
      .filter((name) => name.endsWith('.md'))
      .map((name) => path.join(root, ...name.split('/')))
      .filter((abs) => fs.existsSync(abs))
      .sort();
  return {ok: true, files};
}
