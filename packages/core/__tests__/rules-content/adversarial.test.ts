import {_resetRegistryForTests, getRules} from '../../src/rule';
import {runRules, RunOptions} from '../../src/runner';
import {EM_DASH, EN_DASH, registerContentRules} from '../../src/rules-content';

const doc = [
  '---',
  'title: "**not stripped**"',
  `subtitle: alpha ${EM_DASH} beta`,
  'tags:',
  '- not-a-prose-list',
  '- still-yaml',
  '---',
  '',
  'This intro paragraph was',
  `hard-wrapped ${EM_DASH} it also has **bold** and __strong__ text`,
  'across three lines.',
  '',
  'A nested list adjacent to the paragraph above:',
  '- outer one',
  '  - inner one',
  '- outer two',
  '',
  '```ts',
  `const s = 'a ${EM_DASH} b';`,
  'const bold = "**kept** and __kept__";',
  `// range 1${EN_DASH}9`,
  '```',
  '',
  '| header one | header two |',
  '| ---------- | ---------- |',
  `| wrapped ${EM_DASH} cell | **bold cell** |`,
  '| second row | tail |',
  '',
  `Inline hazards: \`x ${EM_DASH}${EM_DASH}flag **y**\`, math $a${EM_DASH}**b**$, link`,
  `https://ex.io/a${EM_DASH}b__c__ and [[Wiki ${EM_DASH} **Page**]] end ${EM_DASH} joined`,
  'with a wrapped tail.',
  '',
  'Pack:',
  '- rope',
  '- water',
  '- a map',
  '',
  `Ranges like 3${EN_DASH}9 survive  `,
  'after an intentional break.',
  '',
].join('\n');

const allFixRules: RunOptions = {
  rules: {
    'join-paragraph-lines': {enabled: true},
    'strip-strong': {enabled: true},
    'replace-em-dash': {enabled: true},
    'prose-list-to-sentences-fix': {enabled: true},
  },
};

describe('content rules registration', () => {
  beforeEach(() => {
    _resetRegistryForTests();
    registerContentRules();
  });

  it('registers exactly the content rules', () => {
    expect(getRules().map((r) => r.id)).toEqual([
      'join-paragraph-lines',
      'strip-strong',
      'replace-em-dash',
      'prose-list-to-sentences',
      'prose-list-to-sentences-fix',
      'header-case',
    ]);
    expect(getRules().every((r) => r.category === 'content')).toBe(true);
  });

  it('registration enables nothing: an empty config changes nothing', () => {
    const result = runRules(doc, {rules: {}});
    expect(result.text).toBe(doc);
    expect(result.changed).toBe(false);
    expect(result.violations).toEqual([]);
  });
});

describe('mixed adversarial document through the full fix pipeline', () => {
  beforeEach(() => {
    _resetRegistryForTests();
    registerContentRules();
  });

  it('transforms prose while leaving every masked region byte-identical', () => {
    const {text} = runRules(doc, allFixRules);

    expect(text).toContain('---\ntitle: "**not stripped**"');
    expect(text).toContain(`subtitle: alpha ${EM_DASH} beta`);
    expect(text).toContain('tags:\n- not-a-prose-list\n- still-yaml\n---');

    expect(text).toContain(`const s = 'a ${EM_DASH} b';`);
    expect(text).toContain('const bold = "**kept** and __kept__";');
    expect(text).toContain(`// range 1${EN_DASH}9`);

    expect(text).toContain(`| wrapped ${EM_DASH} cell | **bold cell** |`);
    expect(text).toContain('| second row | tail |');

    expect(text).toContain(`\`x ${EM_DASH}${EM_DASH}flag **y**\``);
    expect(text).toContain(`$a${EM_DASH}**b**$`);
    expect(text).toContain(`https://ex.io/a${EM_DASH}b__c__`);
    expect(text).toContain(`[[Wiki ${EM_DASH} **Page**]]`);

    expect(text).toContain(
      'This intro paragraph was hard-wrapped, it also has bold and strong text across three lines.',
    );
    expect(text).toContain('- outer one\n  - inner one\n- outer two');
    expect(text).toContain('Pack: rope, water, and a map.');
    expect(text).toContain(`end, joined with a wrapped tail.`);
    expect(text).toContain(`Ranges like 3${EN_DASH}9 survive  \nafter an intentional break.`);
  });

  it('the full pipeline is idempotent', () => {
    const once = runRules(doc, allFixRules).text;
    const twice = runRules(once, allFixRules).text;
    expect(twice).toBe(once);
  });
});
