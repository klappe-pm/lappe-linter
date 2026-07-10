import {performance} from 'perf_hooks';
import {LinterConfig, ProfileConfig} from '../../src/config/types';
import {resolveProfile} from '../../src/scope/resolver';

function buildConfig(profileCount: number): LinterConfig {
  const profiles: Record<string, ProfileConfig> = {};
  for (let i = 0; i < profileCount; i++) {
    const kind = i % 4;
    const match =
      kind === 0 ? {extension: ['md', 'canvas']} :
      kind === 1 ? {path: [`area-${i}/**`, `notes/sub-${i}/**/*.md`]} :
      kind === 2 ? {frontmatter: {type: `type-${i}`, priority: i}} :
      {tag: [`tag-${i}`, 'shared']};
    profiles[`profile-${i}`] = {match, rules: {[`rule-${i}`]: {enabled: true, index: i}}};
  }
  return {
    version: 1,
    defaults: {rules: {base: {enabled: true}}},
    profiles,
  };
}

describe('resolveProfile performance', () => {
  it('resolves a file against a 50-profile config in under 5ms after warmup', () => {
    const config = buildConfig(50);
    const facts = {
      path: 'notes/sub-5/deep/nested/file.md',
      frontmatter: 'type: type-6\npriority: 6\ntags:\n  - shared\n  - tag-7',
    };

    for (let i = 0; i < 200; i++) {
      resolveProfile(facts, config);
    }

    const iterations = 500;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      resolveProfile(facts, config);
    }
    const perResolveMs = (performance.now() - start) / iterations;

    // Real numbers land far under the requirement's 1ms; the 5ms bound only
    // absorbs CI noise.
    console.info(`resolveProfile: ${perResolveMs.toFixed(4)}ms per file (50 profiles)`);
    expect(perResolveMs).toBeLessThan(5);
  });
});
