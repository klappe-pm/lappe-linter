import {lintText} from '@lappe-linter/core';
import {CliFlags} from './args';
import {ConfigCache} from './config-discovery';
import {CliIo} from './io';
import {isIgnored, reportConfigErrors} from './lint-run';

/**
 * fix --stdin filter mode for hook pipelines: read the whole document from
 * stdin, write the fixed text to stdout. On config errors the input is echoed
 * back UNCHANGED before exiting 2, so a naive `cli fix --stdin > file` pipe
 * never truncates content. Scope resolution uses --stdin-path (config-dir
 * relative) when given, else "stdin.md". --json is ignored here: stdout is
 * reserved for the document.
 */

export const DEFAULT_STDIN_PATH = 'stdin.md';

export async function runStdinFix(
    flags: CliFlags,
    io: CliIo,
    cache: ConfigCache,
    today: string,
): Promise<number> {
  const input = await io.readStdin();
  const cfg = flags.config !== undefined ? cache.loadPath(flags.config, io.cwd) : cache.forDir(io.cwd);
  if (!cfg.ok) {
    reportConfigErrors(cfg.messages, io);
    io.stdout(input);
    return 2;
  }
  const relPath = flags.stdinPath ?? DEFAULT_STDIN_PATH;
  if (isIgnored(cfg.loaded.config, relPath)) {
    io.stdout(input);
    return 0;
  }
  const result = lintText({text: input, path: relPath, config: cfg.loaded.config, today});
  io.stdout(result.text);
  return 0;
}
