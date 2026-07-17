/**
 * Structured telemetry events (WS-D of the unified system plan). Pure and
 * clock-free: the caller supplies ts / run_id / repo (the CLI and plugin may
 * read the clock; core never does). Every event carries {v, kind} so a mixed
 * JSONL stream is self-describing; consumers filter by `kind`. JSONL is the
 * wire format, ingested into session-data beside the existing lint_events
 * (CLI --json output-version 1). Key order is fixed for stable diffs.
 */

export type TelemetryTrigger =
  | 'on-write'
  | 'on-create'
  | 'on-rename'
  | 'pre-commit'
  | 'ci'
  | 'schedule'
  | 'manual';

/** One template application or check, for template-usage reporting. */
export interface TemplateEvent {
  v: 1;
  kind: 'template';
  ts: string;
  run_id: string;
  trigger: TelemetryTrigger;
  repo: string;
  path: string;
  /** Resolved template name, or 'global' when only the base applied. */
  template: string;
  /** Match-kind names that selected the scoped template (e.g. ['path']). */
  scope_matched: string[];
  keys_applied: string[];
  toggles_overridden: string[];
  mode: 'apply' | 'preview';
}

/** One check/fix run envelope, for run-frequency and violation reporting. */
export interface RunSummary {
  v: 1;
  kind: 'run';
  run_id: string;
  trigger: TelemetryTrigger;
  repo: string;
  action: 'check' | 'fix';
  files_scanned: number;
  files_changed: number;
  violations: number;
  fixes: number;
  exit_code: number;
  ts_start: string;
  ts_end: string;
}

export type TelemetryEvent = TemplateEvent | RunSummary;

export function makeTemplateEvent(fields: Omit<TemplateEvent, 'v' | 'kind'>): TemplateEvent {
  return {v: 1, kind: 'template', ...fields};
}

export function makeRunSummary(fields: Omit<RunSummary, 'v' | 'kind'>): RunSummary {
  return {v: 1, kind: 'run', ...fields};
}

/** Serialize one event as a single JSONL line (trailing newline), stable key order. */
export function toJsonl(event: TelemetryEvent): string {
  if (event.kind === 'template') {
    return `${JSON.stringify({
      v: event.v,
      kind: event.kind,
      ts: event.ts,
      run_id: event.run_id,
      trigger: event.trigger,
      repo: event.repo,
      path: event.path,
      template: event.template,
      scope_matched: event.scope_matched,
      keys_applied: event.keys_applied,
      toggles_overridden: event.toggles_overridden,
      mode: event.mode,
    })}\n`;
  }
  return `${JSON.stringify({
    v: event.v,
    kind: event.kind,
    run_id: event.run_id,
    trigger: event.trigger,
    repo: event.repo,
    action: event.action,
    files_scanned: event.files_scanned,
    files_changed: event.files_changed,
    violations: event.violations,
    fixes: event.fixes,
    exit_code: event.exit_code,
    ts_start: event.ts_start,
    ts_end: event.ts_end,
  })}\n`;
}
