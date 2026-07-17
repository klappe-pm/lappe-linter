import {renderTemplate} from '../../src/templates/render';
import {ResolvedTemplate} from '../../src/templates/types';

function resolved(over: Partial<ResolvedTemplate> = {}): ResolvedTemplate {
  return {
    name: null,
    chain: ['global'],
    frontmatter: {},
    pinnedKeys: [],
    keyOrder: [],
    body: '',
    ageLine: false,
    ...over,
  };
}

describe('renderTemplate', () => {
  it('renders ordered frontmatter and substitutes the title', () => {
    const text = renderTemplate(
        resolved({
          frontmatter: {domain: 'product', status: 'NEW'},
          keyOrder: ['status', 'domain'],
          body: '# {{title}}\n\n## Notes',
        }),
        {title: 'North Star'},
    );
    expect(text).toBe(
        [
          '---',
          'status: NEW',
          'domain: product',
          '---',
          '',
          '# North Star',
          '',
          '## Notes',
          '',
        ].join('\n'),
    );
  });

  it('writes empty arrays in house style', () => {
    const text = renderTemplate(resolved({frontmatter: {aliases: [], tags: ['a']}}));
    expect(text).toContain('aliases:\n');
    expect(text).toContain('tags:\n  - a');
  });

  it('fills null date keys from today and emits the age line', () => {
    const text = renderTemplate(
        resolved({
          frontmatter: {'date-created': null, 'date-revised': null},
          ageLine: true,
        }),
        {today: '2026-07-17'},
    );
    expect(text).toContain('date-created: 2026-07-17');
    expect(text).toContain('date-revised: 2026-07-17');
    expect(text).toContain('> age: 1-5');
  });

  it('is clock-free: no dates or age line without a supplied today', () => {
    const text = renderTemplate(
        resolved({frontmatter: {'date-created': null}, ageLine: true, body: 'x'}),
    );
    expect(text).toContain('date-created:');
    expect(text).not.toMatch(/date-created: \d/);
    expect(text).not.toContain('> age:');
  });

  it('never overwrites a date the template already set', () => {
    const text = renderTemplate(
        resolved({frontmatter: {'date-created': '2020-01-01'}}),
        {today: '2026-07-17'},
    );
    expect(text).toContain('date-created: 2020-01-01');
  });
});
