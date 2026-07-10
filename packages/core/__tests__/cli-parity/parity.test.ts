import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {lintText, parseLinterConfig, registerAllRules} from '@lappe-linter/core';
import {run} from '../../../cli/src/index';
import {CliIo} from '../../../cli/src/io';

/**
 * F06 R1: the CLI must produce byte-identical transforms to the plugin path.
 * Both call core's lintText, so parity holds by construction; this suite
 * proves it anyway by running `fix` (on disk and via --stdin) over a fixture
 * corpus covering the F03 note-type, F04 filename, and F05 content rules and
 * comparing against a direct lintText call, byte for byte. Both sides import
 * the same @lappe-linter/core instance, the one the CLI ships with.
 */

const EM_DASH = String.fromCharCode(0x2014);
const TODAY = '2026-07-10';

const CONFIG_YAML = [
  'version: 1',
  'defaults:',
  '  rules:',
  '    join-paragraph-lines: {enabled: true}',
  '    strip-strong: {enabled: true}',
  '    replace-em-dash: {enabled: true}',
  '    prose-list-to-sentences-fix: {enabled: true}',
  '    h1-matches-stem: {enabled: true}',
  '    kebab-case-filename: {enabled: true}',
  '    note-type-insert-keys: {enabled: true}',
  '    note-type-key-sort: {enabled: true}',
  '    note-type-date-keys: {enabled: true}',
  '    note-type-validate: {enabled: true}',
  'profiles:',
  '  raw-notes:',
  '    match:',
  '      path: ["raw/**"]',
  '    rules:',
  '      replace-em-dash: {enabled: false}',
  '      strip-strong: {enabled: false}',
  'note-types:',
  '  task:',
  '    match:',
  '      frontmatter: {category: task}',
  '    required:',
  '      domain: general',
  '      category: null',
  '      status: NEW',
  '    key-order: [domain, category, status, date-created, date-revised]',
  '    values:',
  '      status: [NEW, DONE]',
  '    date-keys:',
  '      created: date-created',
  '      revised: date-revised',
  'rename:',
  '  mode: flag',
  '',
].join('\n');

/** Fixture corpus: relative path -> original content. */
const FIXTURES: Record<string, string> = {
  'em-dash.md': `Alpha${EM_DASH}beta gamma.\n`,
  'hard-wrap.md': 'Line one\nline two of the same paragraph.\n\nNext paragraph alone.\n',
  'strong.md': 'Some **bold** and __underscored strong__ text.\n',
  'prose-list.md': '# prose-list\n\nContext paragraph.\n\n- first thing happened\n- second thing happened\n',
  'h1-mismatch.md': '# Wrong Title\n\nBody text.\n',
  'My Draft.md': `No heading and a dash${EM_DASH}here.\n`,
  'task-missing-keys.md': '---\ncategory: task\n---\n\nTask body.\n',
  'task-unsorted-keys.md': '---\nstatus: DONE\ncategory: task\ndomain: general\n---\n\nTask body.\n',
  'task-date-keys.md': `---\ncategory: task\ndomain: general\nstatus: NEW\n---\n\nEdited${EM_DASH}body.\n`,
  'task-bad-value.md': '---\ncategory: task\ndomain: general\nstatus: MAYBE\n---\n\nTask body.\n',
  'raw/scoped.md': `Dash${EM_DASH}stays and **strong stays** here.\n`,
  'combined.md': `---\ncategory: task\n---\n\nHard wrapped\nline with **bold** and${EM_DASH}dash.\n\n- one item\n- two items\n`,
};

interface Captured {
  code: number;
  out: string;
}

async function runCli(args: string[], cwd: string, stdin = ''): Promise<Captured> {
  let out = '';
  const io: CliIo = {
    cwd,
    stdout: (text) => {
      out += text;
    },
    stderr: () => undefined,
    readStdin: () => Promise.resolve(stdin),
  };
  const code = await run(['node', 'lappe-linter', ...args], io);
  return {code, out};
}

function setupVault(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lappe-parity-'));
  fs.writeFileSync(path.join(dir, 'linter.yaml'), CONFIG_YAML);
  for (const [rel, content] of Object.entries(FIXTURES)) {
    const abs = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    fs.writeFileSync(abs, content);
  }
  return dir;
}

describe('CLI/plugin parity over the fixture corpus (R1)', () => {
  const parsed = parseLinterConfig(CONFIG_YAML);
  if (!parsed.ok) {
    throw new Error(`parity config must parse: ${JSON.stringify(parsed.errors)}`);
  }
  const config = parsed.config;

  beforeAll(() => {
    registerAllRules();
  });

  it.each(Object.keys(FIXTURES))('fix on disk matches lintText byte-for-byte: %s', async (rel) => {
    const dir = setupVault();
    const expected = lintText({text: FIXTURES[rel], path: rel, config, today: TODAY});

    const result = await runCli(['fix', rel, '--today', TODAY, '--json'], dir);
    expect(result.code).toBe(0);

    const onDisk = fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
    expect(onDisk).toBe(expected.text);

    const line = JSON.parse(result.out.trimEnd()) as {
      path: string;
      profile: string;
      violations: Array<{rule: string; line: number | null; message: string; fixed: boolean}>;
    };
    expect(line.path).toBe(rel);
    expect(line.profile).toBe(expected.profileChain[expected.profileChain.length - 1]);
    expect(line.violations).toEqual(
      expected.violations.map((v) => ({
        rule: v.rule,
        line: v.line ?? null,
        message: v.message,
        fixed: v.fixed,
      })),
    );
  });

  it.each(Object.keys(FIXTURES))('fix --stdin matches lintText byte-for-byte: %s', async (rel) => {
    const dir = setupVault();
    const expected = lintText({text: FIXTURES[rel], path: rel, config, today: TODAY});

    const result = await runCli(['fix', '--stdin', '--stdin-path', rel, '--today', TODAY], dir, FIXTURES[rel]);
    expect(result.code).toBe(0);
    expect(result.out).toBe(expected.text);
  });

  it('every fixture is idempotent through the CLI: a second fix changes nothing', async () => {
    const dir = setupVault();
    const rels = Object.keys(FIXTURES);
    for (const rel of rels) {
      const first = await runCli(['fix', rel, '--today', TODAY], dir);
      expect(first.code).toBe(0);
    }
    for (const rel of rels) {
      const before = fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
      const second = await runCli(['fix', rel, '--today', TODAY], dir);
      expect(second.code).toBe(0);
      expect(second.out).toBe('');
      expect(fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8')).toBe(before);
    }
  });

  it('check reports the same violation set lintText computes', async () => {
    const dir = setupVault();
    for (const rel of Object.keys(FIXTURES)) {
      const expected = lintText({text: FIXTURES[rel], path: rel, config, today: TODAY});
      const result = await runCli(['check', rel, '--today', TODAY, '--json'], dir);
      expect(result.code).toBe(expected.violations.length > 0 ? 1 : 0);
      const line = JSON.parse(result.out.trimEnd()) as {violations: Array<{rule: string}>};
      expect(line.violations.map((v) => v.rule)).toEqual(expected.violations.map((v) => v.rule));
    }
  });
});
