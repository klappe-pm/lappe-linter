import * as path from 'path';
import {ProfileMatch, TelemetryTrigger} from '@lappe-linter/core';
import {CliFlags} from './args';

/**
 * CLI-side telemetry helpers. Unlike core, the CLI may read the clock and
 * randomness: run ids and timestamps are stamped here and passed into the pure
 * event builders. Repo is the config directory's basename (the vault/repo
 * root), matching how the harness spool attributes events.
 */

export function newRunId(): string {
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function repoOf(configDir: string): string {
  return path.basename(configDir);
}

export function triggerOf(flags: CliFlags): TelemetryTrigger {
  return (flags.trigger as TelemetryTrigger | undefined) ?? 'manual';
}

/** Match-kind names present on a scope, for a template event's scope_matched. */
export function matchKinds(match: ProfileMatch | undefined): string[] {
  if (!match) {
    return [];
  }
  const kinds: string[] = [];
  for (const key of ['path', 'extension', 'frontmatter', 'tag', 'age', 'date-created', 'date-revised', 'backlink', 'alias'] as const) {
    if (match[key] !== undefined) {
      kinds.push(key);
    }
  }
  return kinds;
}
