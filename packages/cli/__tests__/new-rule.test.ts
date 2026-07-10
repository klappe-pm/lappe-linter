import * as fs from 'fs';
import * as path from 'path';
import {makeTmpDir, runCli} from './common';

function makeFakeRepo(): string {
  const dir = makeTmpDir('lappe-cli-newrule-');
  fs.mkdirSync(path.join(dir, 'packages', 'core', 'src'), {recursive: true});
  fs.mkdirSync(path.join(dir, 'packages', 'core', '__tests__'), {recursive: true});
  return dir;
}

describe('new-rule scaffolding (dec-003)', () => {
  it('scaffolds the rule stub, its test, the barrel, and prints registration steps', async () => {
    const dir = makeFakeRepo();
    const result = await runCli(['new-rule', 'no-trailing-space'], dir);
    expect(result.code).toBe(0);

    const rulePath = path.join(dir, 'packages', 'core', 'src', 'rules-custom', 'no-trailing-space.ts');
    const testPath = path.join(dir, 'packages', 'core', '__tests__', 'rules-custom', 'no-trailing-space.test.ts');
    const barrelPath = path.join(dir, 'packages', 'core', 'src', 'rules-custom', 'index.ts');

    const rule = fs.readFileSync(rulePath, 'utf8');
    expect(rule).toContain("id: 'no-trailing-space'");
    expect(rule).toContain('export const noTrailingSpaceRule: CoreRule');

    const test = fs.readFileSync(testPath, 'utf8');
    expect(test).toContain("from '../../src/rules-custom/no-trailing-space'");

    const barrel = fs.readFileSync(barrelPath, 'utf8');
    expect(barrel).toContain('registerCustomRules');
    expect(barrel).toContain('registerRule(noTrailingSpaceRule)');

    expect(result.out).toContain('registerCustomRules');
    expect(result.out).toContain('defaults.rules.no-trailing-space.enabled: true');
  });

  it('works from a nested cwd and never edits an existing barrel', async () => {
    const dir = makeFakeRepo();
    const barrelPath = path.join(dir, 'packages', 'core', 'src', 'rules-custom', 'index.ts');
    fs.mkdirSync(path.dirname(barrelPath), {recursive: true});
    const existingBarrel = '// existing barrel\n';
    fs.writeFileSync(barrelPath, existingBarrel);
    const nested = path.join(dir, 'packages', 'cli');
    fs.mkdirSync(nested, {recursive: true});

    const result = await runCli(['new-rule', 'second-rule'], nested);
    expect(result.code).toBe(0);
    expect(fs.readFileSync(barrelPath, 'utf8')).toBe(existingBarrel);
    expect(result.out).toContain("import {secondRuleRule} from './second-rule';");
  });

  it('rejects non-kebab-case names with a hint', async () => {
    const dir = makeFakeRepo();
    const result = await runCli(['new-rule', 'My Rule'], dir);
    expect(result.code).toBe(2);
    expect(result.err).toContain('kebab-case');
    expect(result.err).toContain('my-rule');
  });

  it('refuses to overwrite an existing rule', async () => {
    const dir = makeFakeRepo();
    expect((await runCli(['new-rule', 'dup-rule'], dir)).code).toBe(0);
    const again = await runCli(['new-rule', 'dup-rule'], dir);
    expect(again.code).toBe(2);
    expect(again.err).toContain('already exists');
  });

  it('exits 2 outside the repo', async () => {
    const dir = makeTmpDir('lappe-cli-norepo-');
    const result = await runCli(['new-rule', 'lost-rule'], dir);
    expect(result.code).toBe(2);
    expect(result.err).toContain('packages/core/src');
  });
});
