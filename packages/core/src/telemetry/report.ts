/**
 * Pure rollup over a telemetry JSONL stream (WS-D / WS-E). Aggregates the
 * template-events, run-summaries, and lint FileReport lines a spool accumulates
 * into a report the CLI, the plugin Reports surface, and harness-logs-analysis
 * all render the same way. No IO, no clock: `since` is supplied by the caller.
 */

export interface ReportSummary {
  since: string | null;
  totals: {
    templateEvents: number;
    runs: number;
    lintFiles: number;
    /** Total violations across run-summaries. */
    runViolations: number;
    /** Total applied fixes across run-summaries. */
    runFixes: number;
  };
  /** Template events per repo. */
  templatesByRepo: Record<string, number>;
  /** Template events per template name, split by apply vs preview. */
  templateUsage: Record<string, {apply: number; preview: number}>;
  /** Run-summary count per trigger. */
  runsByTrigger: Record<string, number>;
  /** Violation frequency per rule, from lint FileReport lines. */
  rules: Record<string, number>;
}

function emptySummary(since: string | null): ReportSummary {
  return {
    since,
    totals: {templateEvents: 0, runs: 0, lintFiles: 0, runViolations: 0, runFixes: 0},
    templatesByRepo: {},
    templateUsage: {},
    runsByTrigger: {},
    rules: {},
  };
}

function bump(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

function afterSince(ts: unknown, since: string | null): boolean {
  if (since === null) {
    return true;
  }
  return typeof ts === 'string' && ts.slice(0, 10) >= since;
}

/**
 * Fold a JSONL telemetry stream into a summary. `since` (ISO yyyy-MM-dd) filters
 * timestamped events (template ts, run ts_start); untimestamped lint FileReport
 * lines are always counted. Malformed lines are skipped, never fatal.
 */
export function aggregateEvents(lines: string[], since: string | null = null): ReportSummary {
  const summary = emptySummary(since);
  for (const raw of lines) {
    const text = raw.trim();
    if (text === '') {
      continue;
    }
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(text) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (obj.kind === 'template') {
      if (!afterSince(obj.ts, since)) {
        continue;
      }
      summary.totals.templateEvents += 1;
      bump(summary.templatesByRepo, String(obj.repo ?? 'unknown'));
      const name = String(obj.template ?? 'unknown');
      const usage = summary.templateUsage[name] ?? {apply: 0, preview: 0};
      if (obj.mode === 'apply') {
        usage.apply += 1;
      } else {
        usage.preview += 1;
      }
      summary.templateUsage[name] = usage;
    } else if (obj.kind === 'run') {
      if (!afterSince(obj.ts_start, since)) {
        continue;
      }
      summary.totals.runs += 1;
      bump(summary.runsByTrigger, String(obj.trigger ?? 'unknown'));
      summary.totals.runViolations += Number(obj.violations ?? 0);
      summary.totals.runFixes += Number(obj.fixes ?? 0);
    } else if (Array.isArray(obj.violations)) {
      // A lint FileReport line (output-version 1): no kind, per-file violations.
      summary.totals.lintFiles += 1;
      for (const v of obj.violations as Array<Record<string, unknown>>) {
        if (v && typeof v.rule === 'string') {
          bump(summary.rules, v.rule);
        }
      }
    }
  }
  return summary;
}

function topEntries(map: Record<string, number>, limit = 10): Array<[string, number]> {
  return Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

/** Render a summary as a Markdown report (the committed `docs/reports/lint/*.md` shape). */
export function renderReportMarkdown(summary: ReportSummary): string {
  const lines: string[] = [];
  lines.push('# Lint & template report');
  lines.push('');
  lines.push(`- Since: ${summary.since ?? 'all time'}`);
  lines.push(`- Template invocations: ${summary.totals.templateEvents}`);
  lines.push(`- Lint runs: ${summary.totals.runs}`);
  lines.push(`- Files linted: ${summary.totals.lintFiles}`);
  lines.push(`- Violations (runs): ${summary.totals.runViolations}`);
  lines.push(`- Fixes applied (runs): ${summary.totals.runFixes}`);
  lines.push('');

  lines.push('## Template usage by repo');
  lines.push('');
  const repos = topEntries(summary.templatesByRepo);
  if (repos.length === 0) {
    lines.push('_none_');
  } else {
    for (const [repo, count] of repos) {
      lines.push(`- ${repo}: ${count}`);
    }
  }
  lines.push('');

  lines.push('## Template usage by template');
  lines.push('');
  const templates = Object.entries(summary.templateUsage).sort(
      (a, b) => (b[1].apply + b[1].preview) - (a[1].apply + a[1].preview) || a[0].localeCompare(b[0]),
  );
  if (templates.length === 0) {
    lines.push('_none_');
  } else {
    for (const [name, u] of templates) {
      lines.push(`- ${name}: ${u.apply + u.preview} (apply ${u.apply}, preview ${u.preview})`);
    }
  }
  lines.push('');

  lines.push('## Top rules fired');
  lines.push('');
  const rules = topEntries(summary.rules);
  if (rules.length === 0) {
    lines.push('_none_');
  } else {
    for (const [rule, count] of rules) {
      lines.push(`- ${rule}: ${count}`);
    }
  }
  lines.push('');

  lines.push('## Runs by trigger');
  lines.push('');
  const triggers = topEntries(summary.runsByTrigger);
  if (triggers.length === 0) {
    lines.push('_none_');
  } else {
    for (const [trigger, count] of triggers) {
      lines.push(`- ${trigger}: ${count}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}
