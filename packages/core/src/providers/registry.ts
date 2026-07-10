import {getRule, registerRule} from '../rule';
import {LinterConfig, NoteTypeSchema, RuleConfig, RulesConfig} from '../config/types';
import {API_VERSION, RuleProvider} from './provider';

export interface RegisterProviderResult {
  ok: boolean;
  reason?: string;
}

interface AcceptedProvider {
  provider: RuleProvider;
  /** Provider-default stanzas keyed by prefixed rule id: enabled plus defaultOptions. */
  defaults: RulesConfig;
  /** Bare (unprefixed) rule ids this provider contributed. */
  bareIds: string[];
}

const providersById = new Map<string, AcceptedProvider>();
const providerIdByNamespace = new Map<string, string>();
let mergedNoteTypes: Record<string, NoteTypeSchema> = {};

function skip(provider: RuleProvider, reason: string): RegisterProviderResult {
  console.warn(`lappe-linter: skipping provider "${provider?.id ?? '<unknown>'}": ${reason}`);
  return {ok: false, reason};
}

/**
 * Register a provider. Never throws (F08 R2): any incompatibility, collision,
 * or provider error degrades to `{ok: false, reason}` plus a console.warn.
 * Accepted providers' rules land in the core rule registry with their id
 * prefixed `<configNamespace>/`, so they cannot collide with built-ins and are
 * indistinguishable from built-ins to the resolver, runner, and CLI (F08 R1).
 */
export function registerProvider(p: RuleProvider): RegisterProviderResult {
  try {
    if (p.apiVersion !== API_VERSION) {
      return skip(p, `api version ${String(p.apiVersion)} is not supported (core speaks ${API_VERSION})`);
    }
    if (providersById.has(p.id)) {
      return skip(p, `provider id "${p.id}" is already registered`);
    }
    const namespaceOwner = providerIdByNamespace.get(p.configNamespace);
    if (namespaceOwner !== undefined) {
      return skip(p, `config namespace "${p.configNamespace}" is already claimed by provider "${namespaceOwner}"`);
    }

    const rules = p.rules();
    const noteTypes = p.noteTypes();

    const seen = new Set<string>();
    for (const rule of rules) {
      const prefixed = `${p.configNamespace}/${rule.id}`;
      if (seen.has(prefixed)) {
        return skip(p, `duplicate rule id "${rule.id}" inside provider`);
      }
      seen.add(prefixed);
      if (getRule(prefixed) !== undefined) {
        return skip(p, `rule id "${prefixed}" collides with an already-registered rule`);
      }
    }

    const defaults: RulesConfig = {};
    const bareIds: string[] = [];
    for (const rule of rules) {
      const prefixed = `${p.configNamespace}/${rule.id}`;
      registerRule({...rule, id: prefixed});
      defaults[prefixed] = {enabled: true, ...(rule.defaultOptions ?? {})};
      bareIds.push(rule.id);
    }

    for (const [name, schema] of Object.entries(noteTypes)) {
      if (name in mergedNoteTypes) {
        console.warn(`lappe-linter: provider "${p.id}" note type "${name}" already exists; keeping the first definition`);
        continue;
      }
      mergedNoteTypes[name] = schema;
    }

    providersById.set(p.id, {provider: p, defaults, bareIds});
    providerIdByNamespace.set(p.configNamespace, p.id);
    return {ok: true};
  } catch (err) {
    return skip(p, `provider threw during registration: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Materialize accepted providers' rule config into `defaults.rules` so the
 * scope engine (F02) resolves provider rules exactly like built-ins. Provider
 * defaults (enabled plus each rule's defaultOptions) seed the stanza; any
 * `providers.<namespace>.rules` stanza from linter.yaml overlays key-by-key
 * (file wins); an explicit `defaults.rules["<namespace>/<id>"]` stanza in the
 * file wins over both. The input config is not mutated. With no providers
 * registered the config passes through with built-in behavior unchanged
 * (F08 R3).
 */
export function mergeProviderConfig(config: LinterConfig): LinterConfig {
  const materialized: RulesConfig = {};
  for (const accepted of providersById.values()) {
    const namespace = accepted.provider.configNamespace;
    const fileStanzas = config.providers?.[namespace]?.rules ?? {};
    for (const bareId of accepted.bareIds) {
      const prefixed = `${namespace}/${bareId}`;
      const fileStanza: RuleConfig = {
        ...(fileStanzas[bareId] ?? {}),
        ...(fileStanzas[prefixed] ?? {}),
      };
      materialized[prefixed] = {...accepted.defaults[prefixed], ...fileStanza};
    }
  }
  return {
    ...config,
    defaults: {
      ...(config.defaults ?? {}),
      rules: {...materialized, ...(config.defaults?.rules ?? {})},
    },
  };
}

/** Accepted providers, in registration order. */
export function getProviders(): RuleProvider[] {
  return [...providersById.values()].map((accepted) => accepted.provider);
}

/** Merged note-type schemas contributed by accepted providers. */
export function getProviderNoteTypes(): Record<string, NoteTypeSchema> {
  return {...mergedNoteTypes};
}

/**
 * Test-only: clear provider bookkeeping. Rules already registered into the
 * core registry are not removed; pair this with `_resetRegistryForTests()`.
 */
export function _resetProvidersForTests(): void {
  providersById.clear();
  providerIdByNamespace.clear();
  mergedNoteTypes = {};
}
