import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {CliIo} from '../src/io';
import {run} from '../src/index';

/**
 * Shared harness for the CLI suites (excluded from testMatch by the root
 * jest config). Commands run in-process through the CliIo seam; nothing here
 * spawns node except the bundle suite, which does so deliberately.
 */

export interface CliRun {
  code: number;
  out: string;
  err: string;
}

export function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export async function runCli(args: string[], cwd: string, stdin = ''): Promise<CliRun> {
  let out = '';
  let err = '';
  const io: CliIo = {
    cwd,
    stdout: (text) => {
      out += text;
    },
    stderr: (text) => {
      err += text;
    },
    readStdin: () => Promise.resolve(stdin),
  };
  const code = await run(['node', 'lappe-linter', ...args], io);
  return {code, out, err};
}

/** U+2014, built at runtime so no source file carries the literal character. */
export const EM_DASH = String.fromCharCode(0x2014);

export const BASIC_CONFIG = [
  'version: 1',
  'defaults:',
  '  rules:',
  '    replace-em-dash:',
  '      enabled: true',
  '    strip-strong:',
  '      enabled: true',
  '',
].join('\n');

export function writeFileEnsuringDir(fileAbs: string, content: string): void {
  fs.mkdirSync(path.dirname(fileAbs), {recursive: true});
  fs.writeFileSync(fileAbs, content);
}
