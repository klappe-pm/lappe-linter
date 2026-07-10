import {FileFacts, LinterConfig} from '../../src/config/types';
import {resolveProfile} from '../../src/scope/resolver';

describe('resolveProfile merge semantics', () => {
  const config: LinterConfig = {
    version: 1,
    defaults: {
      rules: {
        'heading-style': {enabled: true, style: 'atx', levels: 3},
        'trailing-space': {enabled: true},
        'only-in-defaults': {enabled: true, keep: 'me'},
      },
    },
    profiles: {
      docs: {
        match: {path: ['docs/**']},
        rules: {
          'heading-style': {levels: 2, extra: 'docs'},
          'trailing-space': {enabled: false},
          'docs-only': {enabled: true},
        },
      },
      deep: {
        match: {path: ['docs/api/**']},
        rules: {
          'heading-style': {style: 'setext'},
        },
      },
    },
  };

  const facts: FileFacts = {path: 'docs/api/a.md', frontmatter: null};

  it('merges option-level, key by key, across the chain', () => {
    const resolved = resolveProfile(facts, config);
    expect(resolved.chain).toEqual(['defaults', 'docs', 'deep']);
    expect(resolved.rules['heading-style']).toEqual({
      enabled: true,
      style: 'setext',
      levels: 2,
      extra: 'docs',
    });
  });

  it('enabled:false in a later profile disables regardless of defaults', () => {
    const resolved = resolveProfile(facts, config);
    expect(resolved.rules['trailing-space']).toEqual({enabled: false});
  });

  it('keeps untouched defaults and adds profile-introduced rules', () => {
    const resolved = resolveProfile(facts, config);
    expect(resolved.rules['only-in-defaults']).toEqual({enabled: true, keep: 'me'});
    expect(resolved.rules['docs-only']).toEqual({enabled: true});
  });

  it('does not mutate the config object across resolutions', () => {
    const before = JSON.stringify(config);
    const first = resolveProfile(facts, config);
    first.rules['heading-style'].enabled = false;
    const second = resolveProfile(facts, config);
    expect(second.rules['heading-style'].enabled).toBe(true);
    expect(JSON.stringify(config)).toBe(before);
  });

  it('handles a config with no defaults and no profiles', () => {
    const bare: LinterConfig = {version: 1};
    expect(resolveProfile(facts, bare)).toEqual({chain: ['defaults'], rules: {}});
  });
});
