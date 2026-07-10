import * as path from 'path';

/**
 * Guard against a dependency split: the repo root and @lappe-linter/core both
 * declare yaml ^2.x and today share one hoisted install, so esbuild bundles
 * the ~104 KB parser exactly once. If a future version bump forks the two
 * resolutions, this fails in CI instead of silently doubling the bundle.
 */
describe('yaml dependency dedupe', () => {
  it('resolves one yaml module for the root and packages/core', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const fromRoot = require.resolve('yaml', {paths: [repoRoot]});
    const fromCore = require.resolve('yaml', {paths: [path.join(repoRoot, 'packages', 'core')]});
    expect(fromCore).toBe(fromRoot);
  });
});
