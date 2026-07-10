import {buildMatch, SCOPE_TYPES} from '../src/lappe/scope-builder-model';

describe('scope builder model', () => {
  it('offers project as a scope type', () => {
    expect(SCOPE_TYPES.some((t) => t.key === 'project')).toBe(true);
  });

  it('maps a folder to a recursive glob', () => {
    expect(buildMatch([{type: 'folder', values: ['notes/']}])).toEqual({path: ['notes/**']});
  });

  it('combines multiple scope types into one match (AND across kinds)', () => {
    const match = buildMatch([
      {type: 'folder', values: ['work']},
      {type: 'tag', values: ['active']},
    ]);
    expect(match).toEqual({path: ['work/**'], tag: ['active']});
  });

  it('maps preset keys to frontmatter predicates', () => {
    const match = buildMatch([
      {type: 'domain', values: ['development']},
      {type: 'project', values: ['harness']},
    ]);
    expect(match).toEqual({frontmatter: {domain: 'development', project: 'harness'}});
  });

  it('parses key=value property selections', () => {
    expect(buildMatch([{type: 'property', values: ['status=DRAFT']}])).toEqual({frontmatter: {status: 'DRAFT'}});
  });

  it('maps age buckets and date ranges', () => {
    expect(buildMatch([{type: 'age', values: ['1-5', '6-10']}])).toEqual({age: ['1-5', '6-10']});
    expect(buildMatch([{type: 'date-created', range: {after: '2026-01-01'}}])).toEqual({'date-created': {after: '2026-01-01'}});
  });

  it('strips extension dots and skips empty values', () => {
    expect(buildMatch([{type: 'extension', values: ['.md', '', ' ']}])).toEqual({extension: ['md']});
  });

  it('maps backlink and alias selections to their own kinds', () => {
    expect(buildMatch([{type: 'backlink', values: ['index']}, {type: 'alias', values: ['MOC']}])).toEqual({backlink: ['index'], alias: ['MOC']});
  });
});
