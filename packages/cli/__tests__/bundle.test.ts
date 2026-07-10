import {execFileSync, spawnSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {BASIC_CONFIG, EM_DASH, makeTmpDir} from './common';

/**
 * Single-file bundle (R6) and startup budget (R3). The target is a cold start
 * under 300 ms for a single-file fix; the assertion allows 1000 ms so CI churn
 * never flakes, and the measured p50 is printed for the record.
 */

const CLI_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(CLI_DIR, '..', '..');
const ESBUILD = path.join(REPO_ROOT, 'node_modules', '.bin', 'esbuild');
const BUNDLE = path.join(CLI_DIR, 'dist', 'lappe-linter-bundle.cjs');

function runBundle(args: string[], cwd: string): {status: number | null; stdout: string} {
  const result = spawnSync('node', [BUNDLE, ...args], {cwd, encoding: 'utf8'});
  return {status: result.status, stdout: result.stdout};
}

describe('single-file bundle', () => {
  beforeAll(() => {
    execFileSync(
      ESBUILD,
      ['src/index.ts', '--bundle', '--platform=node', '--outfile=dist/lappe-linter-bundle.cjs', '--log-level=error'],
      {cwd: CLI_DIR},
    );
  }, 60000);

  it('runs standalone and prints --version', () => {
    const dir = makeTmpDir('lappe-cli-bundle-');
    const result = runBundle(['--version'], dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it('fixes a file end to end from the bundle', () => {
    const dir = makeTmpDir('lappe-cli-bundle-');
    fs.writeFileSync(path.join(dir, 'linter.yaml'), BASIC_CONFIG);
    fs.writeFileSync(path.join(dir, 'note.md'), `Alpha${EM_DASH}beta.\n`);
    const result = runBundle(['fix', 'note.md'], dir);
    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'note.md'), 'utf8')).toBe('Alpha, beta.\n');
  });

  it('single-file fix p50 stays inside the startup budget', () => {
    const dir = makeTmpDir('lappe-cli-budget-');
    fs.writeFileSync(path.join(dir, 'linter.yaml'), BASIC_CONFIG);

    const samples: number[] = [];
    for (let i = 0; i < 9; i++) {
      fs.writeFileSync(path.join(dir, 'note.md'), `Sample${EM_DASH}text run ${i}.\n`);
      const start = process.hrtime.bigint();
      const result = runBundle(['fix', 'note.md'], dir);
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      expect(result.status).toBe(0);
      samples.push(elapsedMs);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)];
    process.stdout.write(`bundle single-file fix p50: ${p50.toFixed(1)} ms (target 300, gate 1000)\n`);
    expect(p50).toBeLessThan(1000);
  }, 30000);
});
