import {
  BUILTIN_CODE_CHECKS,
  collectCodeCheckViolations,
  codeChecksFixRule,
  MAX_LINE_LENGTH,
} from '../../src/code-checks';
import {parseLinterConfig} from '../../src/config/loader';
import {CodeCheckConfig} from '../../src/config/types';

function enabled(id: string, extra: Partial<CodeCheckConfig> = {}): Record<string, CodeCheckConfig> {
  return {[id]: {...BUILTIN_CODE_CHECKS[id], enabled: true, ...extra}};
}

const SECRET = 'AKIAIOSFODNN7EXAMPLE';

describe('code-checks engine', () => {
  it('flags token-shaped strings inside fences only, and never echoes the match', () => {
    const text = `Prose mentioning ${SECRET} is ignored.\n\n\`\`\`python\nkey = "${SECRET}"\n\`\`\`\n`;
    const violations = collectCodeCheckViolations(text, enabled('no-token-shaped-strings'));
    expect(violations).toHaveLength(1);
    expect(violations[0].check).toBe('no-token-shaped-strings');
    expect(violations[0].line).toBe(4);
    expect(JSON.stringify(violations)).not.toContain(SECRET);
  });

  it('language-scoped checks skip fences of other languages', () => {
    const bash = '```bash\nsed -i "s/a/b/" file.txt\n```\n';
    const python = '```python\nsed = "-i"\nsed -i\n```\n';
    const checks = enabled('no-gnu-only-flags-in-sh');
    expect(collectCodeCheckViolations(bash, checks)).toHaveLength(1);
    expect(collectCodeCheckViolations(python.replace('python', 'python'), checks)).toHaveLength(0);
  });

  it('portable sed -i with the empty BSD arg passes', () => {
    const text = "```bash\nsed -i '' 's/a/b/' file.txt\n```\n";
    expect(collectCodeCheckViolations(text, enabled('no-gnu-only-flags-in-sh'))).toHaveLength(0);
  });

  it('path-scoped checks require a matching path', () => {
    const checks = enabled('no-token-shaped-strings', {paths: ['projects/**']});
    const text = `\`\`\`js\nconst k = "${SECRET}"\n\`\`\`\n`;
    expect(collectCodeCheckViolations(text, checks, 'projects/app/note.md')).toHaveLength(1);
    expect(collectCodeCheckViolations(text, checks, 'journal/day.md')).toHaveLength(0);
    expect(collectCodeCheckViolations(text, checks, undefined)).toHaveLength(0);
  });

  it('fixing rule strips trailing whitespace in fences, leaves prose intact, idempotent', () => {
    const example = codeChecksFixRule.examples![0];
    const out = codeChecksFixRule.apply(example.before, example.options ?? {});
    expect(out).toBe(example.after);
    expect(codeChecksFixRule.apply(out, example.options ?? {})).toBe(out);
  });

  it('invalid user regex is skipped without throwing', () => {
    const checks: Record<string, CodeCheckConfig> = {
      broken: {enabled: true, pattern: '([unclosed', message: 'x'},
    };
    expect(collectCodeCheckViolations('```js\nvar a\n```\n', checks)).toEqual([]);
  });

  it('bounded execution: pathological pattern on a capped line finishes fast', () => {
    const evil: Record<string, CodeCheckConfig> = {
      redos: {enabled: true, pattern: '(a+)+$', message: 'evil'},
    };
    const longLine = 'a'.repeat(MAX_LINE_LENGTH + 10) + '!';
    const text = '```txt\n' + longLine + '\n```\n';
    const start = Date.now();
    expect(collectCodeCheckViolations(text, evil)).toEqual([]);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('unclosed fences run to EOF and still get checked', () => {
    const text = '```bash\nreadlink -f thing\n';
    expect(collectCodeCheckViolations(text, enabled('no-gnu-only-flags-in-sh'))).toHaveLength(1);
  });
});

describe('code-checks enablement through lintText', () => {
  it('an enabled check activates the carrier rules even without defaults.rules', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {lintText, registerAllRules} = require('../../src/index');
    registerAllRules();
    const config = {
      version: 1 as const,
      'code-checks': {'no-gnu-only-flags-in-sh': {...BUILTIN_CODE_CHECKS['no-gnu-only-flags-in-sh'], enabled: true}},
    };
    const result = lintText({
      text: '```bash\nreadlink -f x\n```\n',
      path: 'projects/script-note.md',
      config,
    });
    expect(result.violations.some((v: {rule: string}) => v.rule === 'code-checks')).toBe(true);
  });
});

describe('code-checks config validation', () => {
  it('accepts the section and warns on a malformed individual check', () => {
    const result = parseLinterConfig(
        'version: 1\ncode-checks:\n  good:\n    enabled: true\n    pattern: "x"\n  bad: 12\n',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.includes('code-checks.bad'))).toBe(true);
      expect(result.config['code-checks']?.['good']?.enabled).toBe(true);
    }
  });

  it('rejects a non-mapping code-checks section', () => {
    const result = parseLinterConfig('version: 1\ncode-checks: [a, b]\n');
    expect(result.ok).toBe(false);
  });
});
