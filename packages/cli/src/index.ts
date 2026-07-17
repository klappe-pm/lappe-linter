#!/usr/bin/env node
/**
 * lappe-linter CLI entry point (F06). Headless twin of the Obsidian plugin:
 * both call core's lintText, so transforms are byte-identical by construction
 * (R1, proven by the cli-parity suite). Exit codes (R4): 0 clean or fixed,
 * 1 check violations, 2 config or usage error.
 */
import {CORE_VERSION, registerAllRules} from '@lappe-linter/core';
import {parseArgs} from './args';
import {ConfigCache} from './config-discovery';
import {runExplain} from './explain';
import {changedMarkdownFiles} from './git-changed';
import {runInit} from './init';
import {CliIo, realIo} from './io';
import {expandTargets, runCheck, runFix} from './lint-run';
import {runExport} from './export-cmd';
import {runNewRule} from './new-rule';
import {runReport} from './report';
import {runAutomation} from './run';
import {runStdinFix} from './stdin';
import {runTemplate} from './template';

const HELP = `lappe-linter ${CORE_VERSION}

Usage:
  lappe-linter <command> [paths...] [flags]

Commands:
  check <paths...>     Report violations, exit 1 if any
  fix <paths...>       Apply fixes, print changed files
  fix --stdin          Filter mode: read stdin, write fixed text to stdout
  explain <path>       Show the governing config, profile chain, and rule set
  new-rule <name>      Scaffold a custom core rule, its test, and registration
                       (see packages/core/src/providers/authoring-guide.md)
  init                 Write a starter linter.yaml to the current directory
  template list        List configured templates (global base + scoped)
  template show <name> Show a template's effective shape and a rendered preview
  template apply <paths...>  Scaffold new notes from the matching template;
                       existing notes are previewed, never overwritten
  template check <paths...>  Report notes missing their template's pinned keys
  run <name> <paths...>  Fire a named automation; honors its failure mode
  run --list           List configured automations
  report               Roll up a telemetry JSONL stream (--input or stdin) to
                       a usage/lint report (--md default, --json for data)
  export               Write a checksummed, secret-scrubbed JSONL bundle
                       (--input or stdin) to --out for cross-container sharing

Flags:
  --config <path>      Config file (default: nearest linter.yaml or
                       lappe-linter.yaml walking up from each target;
                       linter.yaml wins in the same directory; linter-styles/
                       profile fragments apply inside Obsidian only for now)
  --json               One JSON line per file (output-version 1)
  --changed            Also target git-changed .md files (HEAD diff + staged)
  --allow-rename       Allow fix to execute renames when rename.mode: rename
  --stdin-path <path>  Assumed config-relative path for fix --stdin
  --today <date>       Override today's ISO date (for date-key rules)
  --dry-run            template apply: print instead of writing new notes
  --enforce            template apply: write template-owned pinned keys into
                       existing scope-matched notes (DEC-104; adds only)
  --list               run: list automations instead of firing one
  --trigger <t>        Telemetry trigger label (on-write|on-create|on-rename|
                       pre-commit|ci|schedule|manual) emitted with --json events
  --input <file>       report/export: telemetry JSONL input (default: stdin)
  --since <date>       report: only count events on/after this ISO date
  --out <dir>          export: output directory (default: .)
  --version            Print version
  --help               Print this help
`;

export async function run(argv: string[], io: CliIo = realIo()): Promise<number> {
  registerAllRules();

  const parsed = parseArgs(argv.slice(2));
  if (!parsed.ok) {
    io.stderr(`lappe-linter: ${parsed.message}\n`);
    io.stderr('run "lappe-linter --help" for usage\n');
    return 2;
  }

  const {command, paths, flags} = parsed.args;
  if (command === 'version') {
    io.stdout(`${CORE_VERSION}\n`);
    return 0;
  }
  if (command === 'help') {
    io.stdout(HELP);
    return 0;
  }
  if (command === 'init') {
    return runInit(io);
  }
  if (command === 'new-rule') {
    return runNewRule(paths[0], io);
  }

  const cache = new ConfigCache();
  const today = flags.today ?? new Date().toISOString().slice(0, 10);

  if (command === 'explain') {
    return runExplain(paths[0], flags, io, cache);
  }

  if (command === 'template') {
    return runTemplate(paths, flags, io, cache, today);
  }

  if (command === 'run') {
    return runAutomation(paths, flags, io, cache, today);
  }

  if (command === 'report') {
    return runReport(flags, io);
  }

  if (command === 'export') {
    return runExport(flags, io);
  }

  if (command === 'fix' && flags.stdin) {
    return runStdinFix(flags, io, cache, today);
  }

  const expanded = expandTargets(paths, io.cwd);
  if (!expanded.ok) {
    io.stderr(`lappe-linter: ${expanded.message}\n`);
    return 2;
  }
  let files = expanded.files;
  if (flags.changed) {
    const changed = changedMarkdownFiles(io.cwd);
    if (!changed.ok) {
      io.stderr(`lappe-linter: ${changed.message}\n`);
      return 2;
    }
    files = [...new Set([...files, ...changed.files])];
  }

  const result = command === 'check' ?
    runCheck(files, flags, io, cache, today) :
    runFix(files, flags, io, cache, today);
  return result.exit;
}

// Only auto-run when invoked as a binary, not when imported by tests.
if (require.main === module) {
  run(process.argv).then(
      (code) => process.exit(code),
      (err: Error) => {
        process.stderr.write(`lappe-linter: ${err.stack ?? err.message}\n`);
        process.exit(2);
      },
  );
}
