#!/usr/bin/env node
/**
 * lappe-linter CLI entry point. F00 ships a working scaffold: it resolves the
 * core version and handles --version/--help so the bin is installable and
 * wired into hooks now. The check/fix/explain/new-rule commands land in F06.
 */
import {CORE_VERSION, getRules} from '@lappe-linter/core';

const HELP = `lappe-linter ${CORE_VERSION}

Usage:
  lappe-linter <command> [paths...] [flags]

Commands (F06):
  check <paths...>     Report violations, exit 1 if any
  fix <paths...>       Apply fixes, print changed files
  explain <path>       Show the resolved profile and rule set
  new-rule <name>      Scaffold a new core rule, its test, and registration

Flags:
  --config <path>      Path to linter.yaml (default: nearest walking up)
  --json               Structured output (output-version 1)
  --version            Print version
  --help               Print this help

Status: scaffold. Core exposes ${getRules().length} registered rule(s).
`;

export function run(argv: string[]): number {
  const args = argv.slice(2);
  if (args.includes('--version')) {
    process.stdout.write(`${CORE_VERSION}\n`);
    return 0;
  }
  if (args.length === 0 || args.includes('--help') || args[0] === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  process.stderr.write(`lappe-linter: command "${args[0]}" not implemented yet (F06)\n`);
  return 2;
}

// Only auto-run when invoked as a binary, not when imported by tests.
if (require.main === module) {
  process.exit(run(process.argv));
}
