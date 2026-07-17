import * as fs from 'fs';
import * as path from 'path';
import {makeTmpDir, runCli} from './common';

const EVENTS = [
  JSON.stringify({v: 1, kind: 'template', ts: '2026-07-17T00:00:00.000Z', run_id: 'r', trigger: 'on-create', repo: 'lappe-linter', path: 'Projects/a.md', template: 'projects', scope_matched: ['path'], keys_applied: ['domain'], toggles_overridden: [], mode: 'apply'}),
  JSON.stringify({v: 1, kind: 'run', run_id: 'r', trigger: 'pre-commit', repo: 'lappe-linter', action: 'check', files_scanned: 2, files_changed: 0, violations: 3, fixes: 0, exit_code: 1, ts_start: '2026-07-17T00:00:00.000Z', ts_end: '2026-07-17T00:00:01.000Z'}),
  '',
].join('\n');

describe('report', () => {
  it('renders a markdown report from --input', async () => {
    const dir = makeTmpDir('lappe-rep-');
    fs.writeFileSync(path.join(dir, 'events.jsonl'), EVENTS);
    const {code, out} = await runCli(['report', '--input', 'events.jsonl'], dir);
    expect(code).toBe(0);
    expect(out).toContain('# Lint & template report');
    expect(out).toContain('Template invocations: 1');
    expect(out).toContain('Lint runs: 1');
  });

  it('emits JSON with --json and reads stdin when no --input', async () => {
    const dir = makeTmpDir('lappe-rep-');
    const {code, out} = await runCli(['report', '--json'], dir, EVENTS);
    expect(code).toBe(0);
    const summary = JSON.parse(out.trim());
    expect(summary.totals.templateEvents).toBe(1);
    expect(summary.totals.runs).toBe(1);
  });

  it('rejects positional paths', async () => {
    const dir = makeTmpDir('lappe-rep-');
    const {code, err} = await runCli(['report', 'foo.md'], dir);
    expect(code).toBe(2);
    expect(err).toContain('takes no paths');
  });
});

describe('export', () => {
  it('writes a checksummed bundle and manifest, scrubbing secrets', async () => {
    const dir = makeTmpDir('lappe-exp-');
    const withSecret = `${EVENTS}${JSON.stringify({v: 1, kind: 'run', note: 'ghp_0123456789abcdefghijABCDEFGHIJ0123'})}\n`;
    fs.writeFileSync(path.join(dir, 'events.jsonl'), withSecret);
    const {code, out} = await runCli(['export', '--input', 'events.jsonl', '--out', 'bundle'], dir);
    expect(code).toBe(0);
    expect(out).toMatch(/wrote bundle\/lappe-export-[0-9a-f]{12}\.jsonl \(3 lines, sha256 [0-9a-f]{12}\)/);

    const files = fs.readdirSync(path.join(dir, 'bundle'));
    const bundle = files.find((f) => f.endsWith('.jsonl'))!;
    const manifestName = files.find((f) => f.endsWith('.manifest.json'))!;
    expect(bundle).toBeDefined();
    const body = fs.readFileSync(path.join(dir, 'bundle', bundle), 'utf8');
    expect(body).toContain('***redacted***');
    expect(body).not.toContain('ghp_0123456789');

    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'bundle', manifestName), 'utf8'));
    expect(manifest.lines).toBe(3);
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(`${bundle}`).toContain(manifest.sha256.slice(0, 12));
  });

  it('is idempotent: identical input yields the same content-hashed bundle name', async () => {
    const dir = makeTmpDir('lappe-exp-');
    fs.writeFileSync(path.join(dir, 'events.jsonl'), EVENTS);
    const first = await runCli(['export', '--input', 'events.jsonl', '--out', 'b'], dir);
    const second = await runCli(['export', '--input', 'events.jsonl', '--out', 'b'], dir);
    expect(first.out).toBe(second.out);
    expect(fs.readdirSync(path.join(dir, 'b')).filter((f) => f.endsWith('.jsonl')).length).toBe(1);
  });
});
