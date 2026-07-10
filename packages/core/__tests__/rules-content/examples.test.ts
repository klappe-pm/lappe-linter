import {CoreRule} from '../../src/rule';
import {
  headerCase,
  joinParagraphLines,
  proseListToSentences,
  proseListToSentencesFix,
  replaceEmDash,
  stripStrong,
} from '../../src/rules-content';

const rules: CoreRule[] = [
  joinParagraphLines,
  stripStrong,
  replaceEmDash,
  proseListToSentences,
  proseListToSentencesFix,
  headerCase,
];

for (const rule of rules) {
  describe(`${rule.id} examples`, () => {
    it('has at least one example', () => {
      expect(rule.examples && rule.examples.length).toBeGreaterThan(0);
    });

    for (const example of rule.examples ?? []) {
      const options = {...(rule.defaultOptions ?? {}), ...(example.options ?? {})};

      it(example.description, () => {
        expect(rule.apply(example.before, options)).toBe(example.after);
      });

      it(`${example.description} (idempotent)`, () => {
        const once = rule.apply(example.before, options);
        expect(rule.apply(once, options)).toBe(once);
      });
    }
  });
}
