import {
  getRules,
  kitchenSinkFixture,
  registerAllRules,
  ruleFixtures,
  testFilesReadme,
} from '../src/index';

beforeAll(() => registerAllRules());

describe('ruleFixtures', () => {
  it('yields exactly one fixture per registered rule with examples', () => {
    const withExamples = getRules().filter((rule) => (rule.examples ?? []).length > 0);
    expect(withExamples.length).toBeGreaterThan(0);
    const names = ruleFixtures().map((fixture) => fixture.name).sort();
    expect(names).toEqual(withExamples.map((rule) => `${rule.id}.md`).sort());
  });

  it('every fixture has non-empty content carrying its explanation', () => {
    for (const fixture of ruleFixtures()) {
      expect(fixture.content.length).toBeGreaterThan(0);
      expect(fixture.explains.length).toBeGreaterThan(0);
      expect(fixture.content).toContain(fixture.explains);
    }
  });

  it('keeps example frontmatter at the top of the file', () => {
    const timestamp = ruleFixtures().find((fixture) => fixture.name === 'yaml-timestamp.md');
    expect(timestamp).toBeDefined();
    expect(timestamp.content.startsWith('---\n')).toBe(true);
    // The explanation must land in the body, after the closing fence.
    expect(timestamp.content.indexOf(timestamp.explains)).toBeGreaterThan(timestamp.content.indexOf('\n---\n'));
  });

  it('fixture content is the messy before text, not the linted after text', () => {
    const emDash = ruleFixtures().find((fixture) => fixture.name === 'replace-em-dash.md');
    expect(emDash).toBeDefined();
    expect(emDash.content).toContain(String.fromCharCode(0x2014));
  });
});

describe('kitchenSinkFixture', () => {
  it('is non-empty and sections every content rule with examples', () => {
    const sink = kitchenSinkFixture();
    expect(sink.length).toBeGreaterThan(0);
    const contentRules = getRules().filter((rule) => rule.category === 'content' && (rule.examples ?? []).length > 0);
    for (const rule of contentRules) {
      expect(sink).toContain(`## ${rule.id}`);
    }
  });

  it('starts with a frontmatter block so frontmatter rules run too', () => {
    expect(kitchenSinkFixture().startsWith('---\n')).toBe(true);
  });
});

describe('testFilesReadme', () => {
  it('names the folder and says it is disposable', () => {
    const readme = testFilesReadme('_archive/2026-07-10-lappe-linter-test-files');
    expect(readme).toContain('_archive/2026-07-10-lappe-linter-test-files');
    expect(readme.toLowerCase()).toContain('disposable');
  });
});
