/**
 * Hand-rolled argv parser. No dependency: the CLI runs per markdown write in
 * hooks, so every module on the require path costs cold-start budget (R3).
 */

export type CliCommand =
  | 'check'
  | 'fix'
  | 'explain'
  | 'new-rule'
  | 'init'
  | 'template'
  | 'run'
  | 'help'
  | 'version';

export interface CliFlags {
  config?: string;
  json: boolean;
  changed: boolean;
  allowRename: boolean;
  stdin: boolean;
  dryRun: boolean;
  list: boolean;
  stdinPath?: string;
  today?: string;
}

export interface ParsedArgs {
  command: CliCommand;
  paths: string[];
  flags: CliFlags;
}

export type ParseResult = {ok: true; args: ParsedArgs} | {ok: false; message: string};

const COMMANDS = new Set(['check', 'fix', 'explain', 'new-rule', 'init', 'template', 'run', 'help']);
const TEMPLATE_SUBCOMMANDS = new Set(['list', 'show', 'apply', 'check']);
const VALUE_FLAGS = new Set(['--config', '--stdin-path', '--today']);
const BOOLEAN_FLAGS = new Set(['--json', '--changed', '--allow-rename', '--stdin', '--dry-run', '--list']);

export function parseArgs(args: string[]): ParseResult {
  const flags: CliFlags = {json: false, changed: false, allowRename: false, stdin: false, dryRun: false, list: false};
  const positionals: string[] = [];
  let wantHelp = false;
  let wantVersion = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') {
      wantHelp = true;
    } else if (arg === '--version') {
      wantVersion = true;
    } else if (VALUE_FLAGS.has(arg)) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        return {ok: false, message: `flag ${arg} requires a value`};
      }
      i++;
      if (arg === '--config') {
        flags.config = value;
      } else if (arg === '--stdin-path') {
        flags.stdinPath = value;
      } else {
        flags.today = value;
      }
    } else if (BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--json') {
        flags.json = true;
      } else if (arg === '--changed') {
        flags.changed = true;
      } else if (arg === '--allow-rename') {
        flags.allowRename = true;
      } else if (arg === '--dry-run') {
        flags.dryRun = true;
      } else if (arg === '--list') {
        flags.list = true;
      } else {
        flags.stdin = true;
      }
    } else if (arg.startsWith('-')) {
      return {ok: false, message: `unknown flag ${arg}`};
    } else {
      positionals.push(arg);
    }
  }

  if (wantVersion) {
    return {ok: true, args: {command: 'version', paths: [], flags}};
  }
  if (wantHelp || positionals.length === 0) {
    return {ok: true, args: {command: 'help', paths: [], flags}};
  }

  const [command, ...paths] = positionals;
  if (!COMMANDS.has(command)) {
    return {ok: false, message: `unknown command "${command}"`};
  }

  if (flags.today !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(flags.today)) {
    return {ok: false, message: '--today must be an ISO date (yyyy-MM-dd)'};
  }
  if (flags.stdin && command !== 'fix') {
    return {ok: false, message: '--stdin is only valid with fix'};
  }
  if (command === 'check' && paths.length === 0 && !flags.changed) {
    return {ok: false, message: 'check requires at least one path or --changed'};
  }
  if (command === 'fix' && paths.length === 0 && !flags.stdin && !flags.changed) {
    return {ok: false, message: 'fix requires at least one path, --stdin, or --changed'};
  }
  if (flags.stdin && (paths.length > 0 || flags.changed)) {
    return {ok: false, message: 'fix --stdin takes no paths and no --changed'};
  }
  if (command === 'explain' && paths.length !== 1) {
    return {ok: false, message: 'explain requires exactly one path'};
  }
  if (command === 'new-rule' && paths.length !== 1) {
    return {ok: false, message: 'new-rule requires exactly one rule name'};
  }
  if (command === 'init' && paths.length > 0) {
    return {ok: false, message: 'init takes no paths'};
  }
  if (command === 'template') {
    const sub = paths[0];
    if (sub === undefined || !TEMPLATE_SUBCOMMANDS.has(sub)) {
      return {ok: false, message: 'template requires a subcommand: list, show, apply, or check'};
    }
    if (sub === 'show' && paths.length !== 2) {
      return {ok: false, message: 'template show requires exactly one template name'};
    }
    if ((sub === 'apply' || sub === 'check') && paths.length < 2) {
      return {ok: false, message: `template ${sub} requires at least one path`};
    }
  }
  if (command === 'run' && !flags.list && paths.length < 1) {
    return {ok: false, message: 'run requires an automation name, or --list'};
  }

  return {ok: true, args: {command: command as CliCommand, paths, flags}};
}
