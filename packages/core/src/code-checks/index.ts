import {CodeCheckConfig} from '../config/types';
import {CoreRule, getRule, registerRule} from '../rule';
import {FENCE_OPEN} from '../rules-content/ignore-zones';
import {compileGlob} from '../scope/matchers';

/**
 * Declarative code linting (dec-006), modeled on the harness project's hook
 * and check idioms (deterministic, path-scoped, no secrets in output) but with
 * a hard security posture: checks are DATA, never code. No user-defined
 * commands, no eval, no dynamic module loading, no network. Every check is a
 * regex run line by line inside fenced code blocks, with bounded execution:
 * lines longer than MAX_LINE_LENGTH are skipped and reporting stops after
 * MAX_MATCHES_PER_FILE hits.
 */

export const MAX_LINE_LENGTH = 2000;
export const MAX_MATCHES_PER_FILE = 100;

/**
 * Built-in checks, all disabled until linter.yaml or the Lappe tab enables
 * them. Messages deliberately never include matched text: a token-shaped
 * secret must not travel from a code block into Notices, CLI output, or the
 * session-data spool.
 */
export const BUILTIN_CODE_CHECKS: Record<string, CodeCheckConfig> = {
  'no-token-shaped-strings': {
    enabled: false,
    description: 'Flag token-shaped literals (cloud keys, bearer tokens, long hex) inside code blocks.',
    pattern: 'AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}|\\b[A-Fa-f0-9]{40,}\\b',
    message: 'token-shaped literal in a code block; move it to a secret reference',
  },
  'no-gnu-only-flags-in-sh': {
    enabled: false,
    description: 'Flag GNU-only shell idioms that break on macOS BSD userland.',
    languages: ['sh', 'bash', 'zsh', 'shell'],
    pattern: 'sed\\s+-i(?!\\s+\'\')(?=\\s|$)|\\breadlink\\s+-f\\b|\\bflock\\b|(?<![.\\w-])timeout\\s+\\d',
    message: 'GNU-only shell idiom; use sed -i \'\' and python3 equivalents for portability',
  },
  'no-trailing-whitespace-in-code': {
    enabled: false,
    description: 'Strip trailing whitespace on lines inside code blocks.',
    pattern: '[ \\t]+$',
    message: 'trailing whitespace in a code block',
    fix: {replacement: ''},
  },
};

interface CompiledCheck {
  id: string;
  regex: RegExp;
  languages: Set<string> | null;
  paths: Array<ReturnType<typeof compileGlob>> | null;
  message: string;
  replacement: string | null;
}

/** Merge built-ins under user config (user wins) and compile the enabled ones. */
export function compileCodeChecks(
    configured: Record<string, CodeCheckConfig> | undefined,
    wantFixing: boolean,
): CompiledCheck[] {
  const merged: Record<string, CodeCheckConfig> = {...BUILTIN_CODE_CHECKS};
  for (const [id, check] of Object.entries(configured ?? {})) {
    merged[id] = {...merged[id], ...check};
  }
  const compiled: CompiledCheck[] = [];
  for (const [id, check] of Object.entries(merged)) {
    if (check.enabled !== true || typeof check.pattern !== 'string') {
      continue;
    }
    const isFixing = check.fix != null && typeof check.fix.replacement === 'string';
    if (wantFixing !== isFixing) {
      continue;
    }
    let regex: RegExp;
    try {
      // "g" so fixing replaces every hit and reporting counts real matches.
      const flags = (check.flags ?? '').replace(/[^imsu]/g, '') + 'g';
      regex = new RegExp(check.pattern, flags);
    } catch {
      continue; // invalid user regex: the loader already warned, skip safely
    }
    compiled.push({
      id,
      regex,
      languages: check.languages ? new Set(check.languages.map((l) => l.toLowerCase())) : null,
      paths: check.paths ? check.paths.map(compileGlob) : null,
      message: check.message ?? check.description ?? id,
      replacement: isFixing ? (check.fix as {replacement: string}).replacement : null,
    });
  }
  return compiled;
}

export interface CodeCheckViolation {
  check: string;
  line: number;
  message: string;
}

interface FencedBlock {
  language: string;
  /** Index of the first content line inside the fence. */
  startLine: number;
  lines: string[];
}

/** Extract fenced code blocks with their languages; unclosed fences run to EOF. */
function fencedBlocks(lines: string[]): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  let open: {marker: string; language: string; startLine: number; content: string[]} | null = null;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(FENCE_OPEN);
    if (open === null) {
      if (match) {
        open = {
          marker: match[1][0],
          language: lines[i].slice(match[0].length).trim().split(/\s+/)[0].toLowerCase(),
          startLine: i + 1,
          content: [],
        };
      }
    } else if (match && match[1][0] === open.marker && lines[i].slice(match[0].length).trim() === '') {
      blocks.push({language: open.language, startLine: open.startLine, lines: open.content});
      open = null;
    } else {
      open.content.push(lines[i]);
    }
  }
  if (open !== null) {
    blocks.push({language: open.language, startLine: open.startLine, lines: open.content});
  }
  return blocks;
}

function checkAppliesTo(check: CompiledCheck, language: string, path: string | undefined): boolean {
  if (check.languages !== null && !check.languages.has(language)) {
    return false;
  }
  if (check.paths !== null) {
    if (path === undefined) {
      return false;
    }
    if (!check.paths.some((glob) => glob.test(path))) {
      return false;
    }
  }
  return true;
}

/**
 * Report-mode evaluation with line numbers, for surfaces that want per-check
 * detail (the runner's violations carry only the rule description).
 */
export function collectCodeCheckViolations(
    text: string,
    configured: Record<string, CodeCheckConfig> | undefined,
    path?: string,
): CodeCheckViolation[] {
  const checks = compileCodeChecks(configured, false);
  if (checks.length === 0) {
    return [];
  }
  const violations: CodeCheckViolation[] = [];
  for (const block of fencedBlocks(text.split('\n'))) {
    for (const check of checks) {
      if (!checkAppliesTo(check, block.language, path)) {
        continue;
      }
      for (let i = 0; i < block.lines.length; i++) {
        if (violations.length >= MAX_MATCHES_PER_FILE) {
          return violations;
        }
        const line = block.lines[i];
        if (line.length > MAX_LINE_LENGTH) {
          continue;
        }
        check.regex.lastIndex = 0;
        if (check.regex.test(line)) {
          violations.push({check: check.id, line: block.startLine + i + 1, message: check.message});
        }
      }
    }
  }
  return violations;
}

/** Apply fixing checks (those with fix.replacement) inside fences only. */
function applyFixingChecks(
    text: string,
    configured: Record<string, CodeCheckConfig> | undefined,
    path?: string,
): string {
  const checks = compileCodeChecks(configured, true);
  if (checks.length === 0) {
    return text;
  }
  const lines = text.split('\n');
  for (const block of fencedBlocks(lines)) {
    for (const check of checks) {
      if (!checkAppliesTo(check, block.language, path)) {
        continue;
      }
      for (let i = 0; i < block.lines.length; i++) {
        const index = block.startLine + i;
        if (lines[index].length > MAX_LINE_LENGTH) {
          continue;
        }
        check.regex.lastIndex = 0;
        lines[index] = lines[index].replace(check.regex, check.replacement as string);
      }
    }
  }
  return lines.join('\n');
}

/** Reporting rule: flags matches, never mutates. Options carry `checks` + ctx path. */
export const codeChecksRule: CoreRule = {
  id: 'code-checks',
  category: 'content',
  description: 'Declarative code checks over fenced code blocks (patterns from linter.yaml code-checks; never executes code).',
  reportOnly: true,
  apply: (text, options, ctx) => {
    const configured = options['checks'] as Record<string, CodeCheckConfig> | undefined;
    // Report-only detection: any violation marks the text as "would change".
    return collectCodeCheckViolations(text, configured, ctx?.path).length > 0 ? `${text} ` : text;
  },
};

/** Fixing rule: applies only checks that define fix.replacement. */
export const codeChecksFixRule: CoreRule = {
  id: 'code-checks-fix',
  category: 'content',
  description: 'Apply fixing code checks (those with fix.replacement) inside fenced code blocks.',
  apply: (text, options, ctx) => {
    const configured = options['checks'] as Record<string, CodeCheckConfig> | undefined;
    return applyFixingChecks(text, configured, ctx?.path);
  },
  examples: [
    {
      description: 'Trailing whitespace strips inside the fence, prose is untouched',
      before: 'Prose with two trailing spaces stays  \n\n```bash\necho hi   \n```\n',
      after: 'Prose with two trailing spaces stays  \n\n```bash\necho hi\n```\n',
      options: {checks: {'no-trailing-whitespace-in-code': {enabled: true, pattern: '[ \\t]+$', fix: {replacement: ''}}}},
    },
  ],
};

/** Explicit registration, idempotent, mirroring the other rule families. */
export function registerCodeChecks(): void {
  for (const rule of [codeChecksRule, codeChecksFixRule]) {
    if (!getRule(rule.id)) {
      registerRule(rule);
    }
  }
}
