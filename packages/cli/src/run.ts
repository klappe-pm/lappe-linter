import {AutomationConfig, makeRunSummary, toJsonl} from '@lappe-linter/core';
import {CliFlags} from './args';
import {ConfigCache, ConfigResult} from './config-discovery';
import {changedMarkdownFiles} from './git-changed';
import {CliIo} from './io';
import {expandTargets, reportConfigErrors, runCheck, runFix} from './lint-run';
import {newRunId, nowIso, repoOf, triggerOf} from './telemetry';

/**
 * `run` command: fire a named automation from linter.yaml. Maps the
 * automation's action to check/fix and honors its failure mode — an
 * authoring automation (`failure: open`) never blocks (exit 0 even on
 * violations), while a gate (`failure: closed`) surfaces the non-zero exit.
 * This is what launchd/cron, the on-write hook, and CI invoke.
 */

const AUTHORING_TRIGGERS = new Set(['on-write', 'on-create', 'on-rename', 'manual', 'schedule']);

function defaultFailure(automation: AutomationConfig): 'open' | 'closed' {
  if (automation.failure) {
    return automation.failure;
  }
  return AUTHORING_TRIGGERS.has(automation.trigger) ? 'open' : 'closed';
}

function loadConfig(flags: CliFlags, io: CliIo, cache: ConfigCache): ConfigResult {
  return flags.config !== undefined ? cache.loadPath(flags.config, io.cwd) : cache.forDir(io.cwd);
}

export function runAutomation(
    paths: string[],
    flags: CliFlags,
    io: CliIo,
    cache: ConfigCache,
    today: string,
): number {
  const cfg = loadConfig(flags, io, cache);
  if (!cfg.ok) {
    reportConfigErrors(cfg.messages, io);
    return 2;
  }
  const automations = cfg.loaded.config.automations ?? [];

  if (flags.list) {
    if (automations.length === 0) {
      io.stdout('no automations configured\n');
      return 0;
    }
    for (const a of automations) {
      io.stdout(
          `${a.name}   trigger:${a.trigger}   action:${a.action ?? 'check'}   failure:${defaultFailure(a)}   log:${a.log ?? 'spool'}\n`,
      );
    }
    return 0;
  }

  const name = paths[0];
  const automation = automations.find((a) => a.name === name);
  if (!automation) {
    io.stderr(`lappe-linter: no automation named "${name}" (try run --list)\n`);
    return 2;
  }

  const targets = paths.slice(1);
  const expanded = expandTargets(targets, io.cwd);
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
  if (files.length === 0) {
    io.stderr(`lappe-linter: automation "${name}" needs target paths or --changed\n`);
    return 2;
  }

  const action = automation.action ?? 'check';
  if (action === 'apply-template') {
    io.stderr(`lappe-linter: automation "${name}" uses apply-template; run it via "template apply"\n`);
    return 2;
  }

  const runId = newRunId();
  const tsStart = nowIso();
  const result = action === 'fix' ?
    runFix(files, flags, io, cache, today) :
    runCheck(files, flags, io, cache, today);
  const tsEnd = nowIso();

  // A config error (2) always propagates without a summary (nothing ran).
  if (result.exit === 2) {
    return 2;
  }

  if (flags.json) {
    io.stdout(toJsonl(makeRunSummary({
      run_id: runId,
      trigger: triggerOf(flags),
      repo: repoOf(cfg.loaded.configDir),
      action,
      files_scanned: files.length,
      files_changed: result.changed,
      violations: result.violations,
      fixes: result.fixes,
      exit_code: result.exit,
      ts_start: tsStart,
      ts_end: tsEnd,
    })));
  }

  // The failure mode decides the process exit: an open automation reports but
  // never blocks; a closed one surfaces the check's exit 1.
  return defaultFailure(automation) === 'open' ? 0 : result.exit;
}
