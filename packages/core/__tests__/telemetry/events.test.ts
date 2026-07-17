import {makeRunSummary, makeTemplateEvent, toJsonl} from '../../src/telemetry/events';

describe('telemetry events', () => {
  it('builds a template event with fixed envelope', () => {
    const e = makeTemplateEvent({
      ts: '2026-07-17T00:00:00.000Z',
      run_id: 'r-1',
      trigger: 'on-create',
      repo: 'lappe-linter',
      path: 'Projects/a.md',
      template: 'projects',
      scope_matched: ['path'],
      keys_applied: ['domain', 'status'],
      toggles_overridden: ['aliases'],
      mode: 'apply',
    });
    expect(e.v).toBe(1);
    expect(e.kind).toBe('template');
  });

  it('serializes a template event as one JSONL line, stable key order', () => {
    const line = toJsonl(makeTemplateEvent({
      ts: '2026-07-17T00:00:00.000Z',
      run_id: 'r-1',
      trigger: 'manual',
      repo: 'repo',
      path: 'a.md',
      template: 'global',
      scope_matched: [],
      keys_applied: ['domain'],
      toggles_overridden: [],
      mode: 'preview',
    }));
    expect(line.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(line);
    expect(Object.keys(parsed)).toEqual([
      'v', 'kind', 'ts', 'run_id', 'trigger', 'repo', 'path',
      'template', 'scope_matched', 'keys_applied', 'toggles_overridden', 'mode',
    ]);
    expect(parsed.kind).toBe('template');
  });

  it('serializes a run summary as one JSONL line', () => {
    const line = toJsonl(makeRunSummary({
      run_id: 'r-2',
      trigger: 'pre-commit',
      repo: 'repo',
      action: 'check',
      files_scanned: 5,
      files_changed: 0,
      violations: 3,
      fixes: 0,
      exit_code: 1,
      ts_start: '2026-07-17T00:00:00.000Z',
      ts_end: '2026-07-17T00:00:01.000Z',
    }));
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({v: 1, kind: 'run', action: 'check', violations: 3, exit_code: 1});
    expect(Object.keys(parsed)).toEqual([
      'v', 'kind', 'run_id', 'trigger', 'repo', 'action',
      'files_scanned', 'files_changed', 'violations', 'fixes', 'exit_code', 'ts_start', 'ts_end',
    ]);
  });
});
