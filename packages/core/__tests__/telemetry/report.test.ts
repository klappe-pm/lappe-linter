import {aggregateEvents, renderReportMarkdown} from '../../src/telemetry/report';

const templateLine = (over: Record<string, unknown> = {}) =>
  JSON.stringify({v: 1, kind: 'template', ts: '2026-07-17T00:00:00.000Z', run_id: 'r', trigger: 'manual', repo: 'lappe-linter', path: 'a.md', template: 'projects', scope_matched: ['path'], keys_applied: ['domain'], toggles_overridden: [], mode: 'apply', ...over});

const runLine = (over: Record<string, unknown> = {}) =>
  JSON.stringify({v: 1, kind: 'run', run_id: 'r', trigger: 'pre-commit', repo: 'lappe-linter', action: 'check', files_scanned: 3, files_changed: 0, violations: 4, fixes: 0, exit_code: 1, ts_start: '2026-07-17T00:00:00.000Z', ts_end: '2026-07-17T00:00:01.000Z', ...over});

const lintLine = JSON.stringify({'path': 'a.md', 'profile': 'defaults', 'violations': [{rule: 'yaml-key-sort', line: null, message: 'x', fixed: true}, {rule: 'yaml-key-sort', line: null, message: 'y', fixed: true}], 'renamed_to': null, 'output-version': 1});

describe('aggregateEvents', () => {
  it('folds template, run, and lint lines into a summary', () => {
    const s = aggregateEvents([
      templateLine(),
      templateLine({repo: 'harness', template: 'daily', mode: 'preview'}),
      runLine(),
      lintLine,
      '',
      'not json',
    ]);
    expect(s.totals.templateEvents).toBe(2);
    expect(s.totals.runs).toBe(1);
    expect(s.totals.runViolations).toBe(4);
    expect(s.totals.lintFiles).toBe(1);
    expect(s.templatesByRepo).toEqual({'lappe-linter': 1, 'harness': 1});
    expect(s.templateUsage.projects).toEqual({apply: 1, preview: 0});
    expect(s.templateUsage.daily).toEqual({apply: 0, preview: 1});
    expect(s.runsByTrigger).toEqual({'pre-commit': 1});
    expect(s.rules).toEqual({'yaml-key-sort': 2});
  });

  it('filters timestamped events by --since but keeps untimestamped lint lines', () => {
    const s = aggregateEvents([
      templateLine({ts: '2026-06-01T00:00:00.000Z'}),
      templateLine({ts: '2026-07-17T00:00:00.000Z'}),
      runLine({ts_start: '2026-06-01T00:00:00.000Z'}),
      lintLine,
    ], '2026-07-01');
    expect(s.totals.templateEvents).toBe(1);
    expect(s.totals.runs).toBe(0);
    expect(s.totals.lintFiles).toBe(1);
  });

  it('renders a markdown report with the key sections', () => {
    const md = renderReportMarkdown(aggregateEvents([templateLine(), runLine(), lintLine]));
    expect(md).toContain('# Lint & template report');
    expect(md).toContain('Template invocations: 1');
    expect(md).toContain('## Template usage by repo');
    expect(md).toContain('## Top rules fired');
    expect(md).toContain('yaml-key-sort: 2');
  });
});
