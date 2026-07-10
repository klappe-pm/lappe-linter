import {performance} from 'perf_hooks';
import {compileGlob} from '../../src/scope/matchers';

/**
 * SEC-002 regression: the recursive ** matcher used to blow up exponentially
 * when a glob stacked several ** segments (8 stacked ** vs a 40-segment path
 * measured ~5s, doubling per added **). A hostile or careless linter.yaml /
 * style file must not be able to hang profile resolution.
 */
describe('compileGlob ReDoS resistance (SEC-002)', () => {
  const TIME_BUDGET_MS = 250;

  it('evaluates a glob of many stacked ** segments in linear-ish time', () => {
    const glob = Array(40).fill('**').join('/') + '/needle';
    const path = Array(80).fill('seg').join('/');
    const compiled = compileGlob(glob);
    const start = performance.now();
    expect(compiled.test(path)).toBe(false);
    expect(compiled.test(path + '/needle')).toBe(true);
    expect(performance.now() - start).toBeLessThan(TIME_BUDGET_MS);
  });

  it('evaluates alternating **/literal globs against a deep path in time', () => {
    const glob = Array(20).fill('**/x').join('/');
    const path = Array(60).fill('x').join('/') + '/y';
    const compiled = compileGlob(glob);
    const start = performance.now();
    expect(compiled.test(path)).toBe(false);
    expect(performance.now() - start).toBeLessThan(TIME_BUDGET_MS);
  });

  it('collapses consecutive ** without changing semantics', () => {
    const doubled = compileGlob('a/**/**/b');
    const single = compileGlob('a/**/b');
    for (const path of ['a/b', 'a/x/b', 'a/x/y/z/b', 'a', 'b', 'a/b/c']) {
      expect(doubled.test(path)).toBe(single.test(path));
    }
    expect(doubled.test('a/b')).toBe(true);
    expect(doubled.test('a/x/y/b')).toBe(true);
    expect(doubled.test('a/b/c')).toBe(false);
  });
});
