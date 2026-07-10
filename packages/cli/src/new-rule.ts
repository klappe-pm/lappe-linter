import * as fs from 'fs';
import * as path from 'path';
import {kebabCaseName} from '@lappe-linter/core';
import {CliIo} from './io';

/**
 * new-rule <name>: Kevin's easy-extension path (dec-003). Scaffolds a pure
 * CoreRule stub under packages/core/src/rules-custom/, a jest sibling under
 * packages/core/__tests__/rules-custom/, and prints the two-line registration
 * instruction. It never edits existing files.
 */

function findRepoRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'packages', 'core', 'src'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

function camelCase(kebab: string): string {
  return kebab.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

function ruleStub(name: string, identifier: string): string {
  return `import {CoreRule} from '../rule';

export const ${identifier}: CoreRule = {
  id: '${name}',
  category: 'content',
  description: 'TODO: one-line description surfaced by lappe-linter explain.',
  apply: (text, _options, _ctx) => {
    // TODO: return the transformed text. Must be pure and idempotent:
    // apply(apply(text)) === apply(text).
    return text;
  },
  examples: [
    {
      description: 'TODO: worked example doubling as the test corpus.',
      before: 'sample\\n',
      after: 'sample\\n',
    },
  ],
};
`;
}

function testStub(name: string, identifier: string): string {
  return `import {${identifier}} from '../../src/rules-custom/${name}';

describe('${name}', () => {
  it('matches its worked examples', () => {
    for (const example of ${identifier}.examples ?? []) {
      expect(${identifier}.apply(example.before, example.options ?? {})).toBe(example.after);
    }
  });

  it('is idempotent', () => {
    const once = ${identifier}.apply('sample\\n', {});
    expect(${identifier}.apply(once, {})).toBe(once);
  });
});
`;
}

function barrelStub(name: string, identifier: string): string {
  return `import {registerRule} from '../rule';
import {${identifier}} from './${name}';

export {${identifier}} from './${name}';

/** Explicit registration entry point for custom rules (dec-003). */
export function registerCustomRules(): void {
  registerRule(${identifier});
}
`;
}

export function runNewRule(name: string, io: CliIo): number {
  const normalized = kebabCaseName(name);
  if (normalized === '' || normalized !== name) {
    const hint = normalized === '' ? '' : `; try "${normalized}"`;
    io.stderr(`lappe-linter: rule name must be kebab-case${hint}\n`);
    return 2;
  }

  const root = findRepoRoot(io.cwd);
  if (root === null) {
    io.stderr(`lappe-linter: no packages/core/src found walking up from ${io.cwd}; run new-rule inside the lappe-linter repo\n`);
    return 2;
  }

  const rulesDir = path.join(root, 'packages', 'core', 'src', 'rules-custom');
  const testsDir = path.join(root, 'packages', 'core', '__tests__', 'rules-custom');
  const rulePath = path.join(rulesDir, `${name}.ts`);
  const testPath = path.join(testsDir, `${name}.test.ts`);
  const barrelPath = path.join(rulesDir, 'index.ts');

  if (fs.existsSync(rulePath)) {
    io.stderr(`lappe-linter: ${path.relative(root, rulePath)} already exists\n`);
    return 2;
  }

  const identifier = `${camelCase(name)}Rule`;
  fs.mkdirSync(rulesDir, {recursive: true});
  fs.mkdirSync(testsDir, {recursive: true});
  fs.writeFileSync(rulePath, ruleStub(name, identifier));
  fs.writeFileSync(testPath, testStub(name, identifier));

  const barrelExisted = fs.existsSync(barrelPath);
  if (!barrelExisted) {
    fs.writeFileSync(barrelPath, barrelStub(name, identifier));
  }

  io.stdout(`created ${path.relative(root, rulePath)}\n`);
  io.stdout(`created ${path.relative(root, testPath)}\n`);
  if (!barrelExisted) {
    io.stdout(`created ${path.relative(root, barrelPath)} (registers ${identifier})\n`);
  }
  io.stdout('\nTo register the rule:\n');
  if (barrelExisted) {
    io.stdout(`  1. In packages/core/src/rules-custom/index.ts add:\n`);
    io.stdout(`       import {${identifier}} from './${name}';\n`);
    io.stdout(`       registerRule(${identifier}); // inside registerCustomRules()\n`);
  } else {
    io.stdout('  1. In packages/core/src/index.ts, import {registerCustomRules} from \'./rules-custom\' and call it inside registerAllRules().\n');
  }
  io.stdout(`  2. Enable it in linter.yaml:  defaults.rules.${name}.enabled: true\n`);
  return 0;
}
