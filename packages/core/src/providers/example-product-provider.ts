import {CoreRule, CoreRuleContext} from '../rule';
import {NoteTypeSchema} from '../config/types';
import {RuleProvider} from './provider';
import {registerProvider, RegisterProviderResult} from './registry';

/**
 * Worked example provider for the product backbone (project > epic > feature
 * > task). This is the compatibility fixture the product-management plugin
 * builds against (F08 R4 / HC-5): if the integration tests over this provider
 * pass, api-version 1 holds.
 */

function frontmatterBlock(text: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  return match ? match[1] : null;
}

function hasKey(frontmatter: string, key: string): boolean {
  return new RegExp(`^${key}\\s*:\\s*\\S`, 'm').test(frontmatter);
}

function isEpic(frontmatter: string | null, ctx?: CoreRuleContext): boolean {
  if (ctx?.noteType === 'epic') {
    return true;
  }
  return frontmatter !== null && /^type\s*:\s*epic\s*$/m.test(frontmatter);
}

const epicRequiresParentProject: CoreRule = {
  id: 'epic-requires-parent-project',
  category: 'provider',
  description: 'Epic notes must declare a parent-project key in their frontmatter.',
  reportOnly: true,
  apply: (text, _options, ctx) => {
    const frontmatter = frontmatterBlock(text);
    if (!isEpic(frontmatter, ctx)) {
      return text;
    }
    if (frontmatter !== null && hasKey(frontmatter, 'parent-project')) {
      return text;
    }
    return `${text}\n`;
  },
};

const productNoteTypes: Record<string, NoteTypeSchema> = {
  project: {
    'required': {status: 'NEW'},
    'key-order': ['status'],
    'match': {frontmatter: {type: 'project'}},
  },
  epic: {
    'required': {'parent-project': null, 'status': 'NEW'},
    'key-order': ['parent-project', 'status'],
    'match': {frontmatter: {type: 'epic'}},
  },
  feature: {
    'required': {'parent-epic': null, 'status': 'NEW'},
    'key-order': ['parent-epic', 'status'],
    'match': {frontmatter: {type: 'feature'}},
  },
  task: {
    'required': {'parent-feature': null, 'status': 'NEW'},
    'key-order': ['parent-feature', 'status'],
    'match': {frontmatter: {type: 'task'}},
  },
};

export const exampleProductProvider: RuleProvider = {
  id: 'example-product',
  apiVersion: 1,
  configNamespace: 'product',
  rules: () => [epicRequiresParentProject],
  noteTypes: () => ({...productNoteTypes}),
};

export function registerExampleProductProvider(): RegisterProviderResult {
  return registerProvider(exampleProductProvider);
}
