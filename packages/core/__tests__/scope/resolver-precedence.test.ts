import {FileFacts, LinterConfig} from '../../src/config/types';
import {resolveProfile} from '../../src/scope/resolver';

/**
 * One config exercising every precedence rank. Each profile stamps
 * rules.marker.winner so the final merge exposes which profile won.
 */
const config: LinterConfig = {
  version: 1,
  defaults: {rules: {marker: {enabled: true, winner: 'defaults'}}},
  profiles: {
    'ext-a': {
      match: {extension: ['md']},
      rules: {marker: {winner: 'ext-a'}},
    },
    'ext-b': {
      match: {extension: ['md']},
      rules: {marker: {winner: 'ext-b'}},
    },
    'path-shallow': {
      match: {path: ['notes/**']},
      rules: {marker: {winner: 'path-shallow'}},
    },
    'path-deep-a': {
      match: {path: ['notes/projects/*']},
      rules: {marker: {winner: 'path-deep-a'}},
    },
    'path-deep-b': {
      match: {path: ['notes/*/deep.md']},
      rules: {marker: {winner: 'path-deep-b'}},
    },
    'fm-a': {
      match: {frontmatter: {type: 'project'}},
      rules: {marker: {winner: 'fm-a'}},
    },
    'fm-b': {
      match: {tag: ['work']},
      rules: {marker: {winner: 'fm-b'}},
    },
    'unmatchable': {
      rules: {marker: {winner: 'unmatchable'}},
    },
  },
};

interface Case {
  name: string;
  facts: FileFacts;
  chain: string[];
  winner: string;
}

const cases: Case[] = [
  {
    name: 'nothing matches => defaults only',
    facts: {path: 'a.txt', frontmatter: null},
    chain: ['defaults'],
    winner: 'defaults',
  },
  {
    name: 'extension beats defaults; extension tie resolves to later declaration',
    facts: {path: 'a.md', frontmatter: null},
    chain: ['defaults', 'ext-a', 'ext-b'],
    winner: 'ext-b',
  },
  {
    name: 'path glob beats extension',
    facts: {path: 'notes/a.md', frontmatter: null},
    chain: ['defaults', 'ext-a', 'ext-b', 'path-shallow'],
    winner: 'path-shallow',
  },
  {
    name: 'deeper glob beats shallower glob',
    facts: {path: 'notes/projects/a.md', frontmatter: null},
    chain: ['defaults', 'ext-a', 'ext-b', 'path-shallow', 'path-deep-a'],
    winner: 'path-deep-a',
  },
  {
    name: 'equal-depth glob tie resolves to later declaration',
    facts: {path: 'notes/projects/deep.md', frontmatter: null},
    chain: ['defaults', 'ext-a', 'ext-b', 'path-shallow', 'path-deep-a', 'path-deep-b'],
    winner: 'path-deep-b',
  },
  {
    name: 'frontmatter beats path glob',
    facts: {path: 'notes/projects/a.md', frontmatter: 'type: project'},
    chain: ['defaults', 'ext-a', 'ext-b', 'path-shallow', 'path-deep-a', 'fm-a'],
    winner: 'fm-a',
  },
  {
    name: 'frontmatter/tag tie resolves to later declaration',
    facts: {path: 'x.txt', frontmatter: 'type: project\ntags:\n  - work'},
    chain: ['defaults', 'fm-a', 'fm-b'],
    winner: 'fm-b',
  },
  {
    name: 'linter-profile override wins outright over every match',
    facts: {
      path: 'notes/projects/a.md',
      frontmatter: 'type: project\nlinter-profile: ext-a',
    },
    chain: ['defaults', 'ext-b', 'path-shallow', 'path-deep-a', 'fm-a', 'ext-a'],
    winner: 'ext-a',
  },
  {
    name: 'linter-profile can name a profile with no matchers',
    facts: {path: 'a.txt', frontmatter: 'linter-profile: unmatchable'},
    chain: ['defaults', 'unmatchable'],
    winner: 'unmatchable',
  },
  {
    name: 'linter-profile naming a nonexistent profile is ignored',
    facts: {path: 'a.txt', frontmatter: 'linter-profile: no-such-profile'},
    chain: ['defaults'],
    winner: 'defaults',
  },
  {
    name: 'malformed frontmatter disables frontmatter matches, keeps path/extension',
    facts: {path: 'notes/a.md', frontmatter: 'type: [unclosed'},
    chain: ['defaults', 'ext-a', 'ext-b', 'path-shallow'],
    winner: 'path-shallow',
  },
];

describe('resolveProfile precedence', () => {
  it.each(cases.map((c): [string, Case] => [c.name, c]))('%s', (_name, c) => {
    const resolved = resolveProfile(c.facts, config);
    expect(resolved.chain).toEqual(c.chain);
    expect(resolved.rules.marker).toEqual({enabled: true, winner: c.winner});
  });

  it('overridden profile that also matched is applied once, at the end', () => {
    const resolved = resolveProfile(
        {path: 'a.md', frontmatter: 'linter-profile: ext-a'},
        config,
    );
    expect(resolved.chain).toEqual(['defaults', 'ext-b', 'ext-a']);
    expect(resolved.rules.marker).toEqual({enabled: true, winner: 'ext-a'});
  });
});

describe('resolveProfile note types', () => {
  const withNoteTypes: LinterConfig = {
    'version': 1,
    'note-types': {
      project: {match: {frontmatter: {type: 'project'}}},
      task: {match: {frontmatter: {type: 'task'}}},
      anything: {match: {frontmatter: {type: ['task', 'project']}}},
      unbound: {},
    },
  };

  it('resolves the first note type whose match resolves, in declaration order', () => {
    expect(resolveProfile({path: 'a.md', frontmatter: 'type: task'}, withNoteTypes).noteType)
        .toBe('task');
    expect(resolveProfile({path: 'a.md', frontmatter: 'type: project'}, withNoteTypes).noteType)
        .toBe('project');
  });

  it('omits noteType when nothing matches', () => {
    expect(resolveProfile({path: 'a.md', frontmatter: 'type: other'}, withNoteTypes).noteType)
        .toBeUndefined();
    expect(resolveProfile({path: 'a.md', frontmatter: null}, withNoteTypes).noteType)
        .toBeUndefined();
  });
});
