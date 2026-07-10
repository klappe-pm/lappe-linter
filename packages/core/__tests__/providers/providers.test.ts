import {_resetRegistryForTests, getRule, getRules, registerRule} from '../../src/rule';
import {ResolvedRuleConfig, runRules} from '../../src/runner';
import {LinterConfig, RulesConfig} from '../../src/config/types';
import {
  API_VERSION,
  RuleProvider,
  registerProvider,
  getProviders,
  getProviderNoteTypes,
  mergeProviderConfig,
  _resetProvidersForTests,
  registerExampleProductProvider,
} from '../../src/providers';

function toResolved(rules: RulesConfig): ResolvedRuleConfig {
  const resolved: ResolvedRuleConfig = {};
  for (const [id, stanza] of Object.entries(rules)) {
    const {enabled, ...options} = stanza;
    resolved[id] = {enabled, options};
  }
  return resolved;
}

function makeProvider(overrides: Partial<RuleProvider> = {}): RuleProvider {
  return {
    id: 'acme',
    apiVersion: 1,
    configNamespace: 'acme',
    rules: () => [
      {
        id: 'no-foo',
        category: 'provider' as const,
        description: 'replaces foo with bar',
        defaultOptions: {replacement: 'bar'},
        apply: (text, options) => text.split('foo').join(String(options.replacement)),
      },
    ],
    noteTypes: () => ({widget: {required: {status: 'NEW'}}}),
    ...overrides,
  };
}

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  _resetRegistryForTests();
  _resetProvidersForTests();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('provider registration', () => {
  it('registers rules under the namespace prefix and exposes note types', () => {
    const result = registerProvider(makeProvider());
    expect(result).toEqual({ok: true});
    expect(getRules().map((r) => r.id)).toEqual(['acme/no-foo']);
    expect(getRule('acme/no-foo')?.description).toBe('replaces foo with bar');
    expect(getProviders().map((p) => p.id)).toEqual(['acme']);
    expect(getProviderNoteTypes()).toEqual({widget: {required: {status: 'NEW'}}});
  });

  it('prefixing prevents collisions with built-in rules', () => {
    registerRule({id: 'no-foo', category: 'content', description: 'built-in', apply: (t) => t});
    const result = registerProvider(makeProvider());
    expect(result.ok).toBe(true);
    expect(getRules().map((r) => r.id).sort()).toEqual(['acme/no-foo', 'no-foo']);
  });

  it('skips a provider with a mismatched api version without throwing', () => {
    const stale = makeProvider({apiVersion: 2 as unknown as 1});
    let result: ReturnType<typeof registerProvider> | undefined;
    expect(() => {
      result = registerProvider(stale);
    }).not.toThrow();
    expect(result?.ok).toBe(false);
    expect(result?.reason).toMatch(/api version 2/);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('skipping provider "acme"'));
    expect(getRules()).toEqual([]);
    expect(getProviders()).toEqual([]);
    expect(getProviderNoteTypes()).toEqual({});
  });

  it('skips a duplicate provider id and a claimed namespace gracefully', () => {
    expect(registerProvider(makeProvider()).ok).toBe(true);
    expect(registerProvider(makeProvider()).ok).toBe(false);
    const sameNamespace = makeProvider({id: 'acme-two'});
    const result = registerProvider(sameNamespace);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/namespace "acme"/);
    expect(getRules().map((r) => r.id)).toEqual(['acme/no-foo']);
  });

  it('degrades to ok:false when the provider throws during registration', () => {
    const broken = makeProvider({
      rules: () => {
        throw new Error('boom');
      },
    });
    const result = registerProvider(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/boom/);
    expect(getRules()).toEqual([]);
  });

  it('exports api version 1', () => {
    expect(API_VERSION).toBe(1);
  });
});

describe('mergeProviderConfig', () => {
  it('materializes provider defaults into defaults.rules when the file is silent', () => {
    registerProvider(makeProvider());
    const merged = mergeProviderConfig({version: 1});
    expect(merged.defaults?.rules?.['acme/no-foo']).toEqual({enabled: true, replacement: 'bar'});
  });

  it('lets linter.yaml stanzas win conflicts over provider defaults', () => {
    registerProvider(makeProvider());
    const config: LinterConfig = {
      version: 1,
      providers: {acme: {rules: {'no-foo': {enabled: false, replacement: 'baz'}}}},
    };
    const merged = mergeProviderConfig(config);
    expect(merged.defaults?.rules?.['acme/no-foo']).toEqual({enabled: false, replacement: 'baz'});
  });

  it('lets an explicit defaults.rules stanza in the file win over everything', () => {
    registerProvider(makeProvider());
    const config: LinterConfig = {
      version: 1,
      defaults: {rules: {'acme/no-foo': {enabled: false}}},
      providers: {acme: {rules: {'no-foo': {enabled: true}}}},
    };
    const merged = mergeProviderConfig(config);
    expect(merged.defaults?.rules?.['acme/no-foo']).toEqual({enabled: false});
  });

  it('does not mutate the input config and passes built-in stanzas through unchanged', () => {
    registerProvider(makeProvider());
    const config: LinterConfig = {version: 1, defaults: {rules: {'built-in': {enabled: true}}}};
    const before = JSON.parse(JSON.stringify(config));
    const merged = mergeProviderConfig(config);
    expect(config).toEqual(before);
    expect(merged.defaults?.rules?.['built-in']).toEqual({enabled: true});
  });

  it('is a no-op on defaults.rules when no provider is registered', () => {
    const config: LinterConfig = {version: 1, defaults: {rules: {'built-in': {enabled: true}}}};
    const merged = mergeProviderConfig(config);
    expect(merged.defaults?.rules).toEqual({'built-in': {enabled: true}});
  });
});

describe('example product provider end-to-end', () => {
  const epicMissingParent = ['---', 'type: epic', 'status: NEW', '---', '', '# rollout epic', ''].join('\n');
  const epicWithParent = ['---', 'type: epic', 'parent-project: ppi-platform', 'status: NEW', '---', '', '# rollout epic', ''].join('\n');

  it('registers and contributes the product-backbone note types', () => {
    expect(registerExampleProductProvider()).toEqual({ok: true});
    const noteTypes = getProviderNoteTypes();
    expect(Object.keys(noteTypes).sort()).toEqual(['epic', 'feature', 'project', 'task']);
    expect(noteTypes.epic.required).toHaveProperty('parent-project');
    expect(noteTypes.feature.required).toHaveProperty('parent-epic');
    expect(noteTypes.task.required).toHaveProperty('parent-feature');
    expect(getRules().map((r) => r.id)).toEqual(['product/epic-requires-parent-project']);
  });

  it('reports an epic note missing parent-project without mutating text', () => {
    registerExampleProductProvider();
    const merged = mergeProviderConfig({version: 1});
    const rules = toResolved(merged.defaults?.rules ?? {});
    const result = runRules(epicMissingParent, {rules, ctx: {path: 'epics/rollout.md', noteType: 'epic'}});
    expect(result.violations).toEqual([
      {
        rule: 'product/epic-requires-parent-project',
        message: 'epic notes must declare a parent-project key in frontmatter',
        fixed: false,
      },
    ]);
    expect(result.text).toBe(epicMissingParent);
    expect(result.changed).toBe(false);
  });

  it('is idempotent: a second run over the same text yields zero diff', () => {
    registerExampleProductProvider();
    const merged = mergeProviderConfig({version: 1});
    const rules = toResolved(merged.defaults?.rules ?? {});
    const first = runRules(epicMissingParent, {rules, ctx: {noteType: 'epic'}});
    const second = runRules(first.text, {rules, ctx: {noteType: 'epic'}});
    expect(second.text).toBe(first.text);
    expect(second).toEqual(first);
  });

  it('passes an epic that carries parent-project', () => {
    registerExampleProductProvider();
    const merged = mergeProviderConfig({version: 1});
    const rules = toResolved(merged.defaults?.rules ?? {});
    const result = runRules(epicWithParent, {rules, ctx: {noteType: 'epic'}});
    expect(result.violations).toEqual([]);
  });

  it('detects an epic by frontmatter type when ctx carries no note type', () => {
    registerExampleProductProvider();
    const merged = mergeProviderConfig({version: 1});
    const rules = toResolved(merged.defaults?.rules ?? {});
    const result = runRules(epicMissingParent, {rules});
    expect(result.violations.map((v) => v.rule)).toEqual(['product/epic-requires-parent-project']);
  });

  it('ignores non-epic notes', () => {
    registerExampleProductProvider();
    const merged = mergeProviderConfig({version: 1});
    const rules = toResolved(merged.defaults?.rules ?? {});
    const task = ['---', 'type: task', 'status: NEW', '---', '', 'do the thing', ''].join('\n');
    const result = runRules(task, {rules, ctx: {noteType: 'task'}});
    expect(result.violations).toEqual([]);
  });

  it('linter.yaml can disable the example rule (file wins)', () => {
    registerExampleProductProvider();
    const config: LinterConfig = {
      version: 1,
      providers: {product: {rules: {'epic-requires-parent-project': {enabled: false}}}},
    };
    const rules = toResolved(mergeProviderConfig(config).defaults?.rules ?? {});
    const result = runRules(epicMissingParent, {rules, ctx: {noteType: 'epic'}});
    expect(result.violations).toEqual([]);
  });
});
