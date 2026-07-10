import {FileFacts, LinterConfig} from '../../src/config/types';
import {resolveProfile} from '../../src/scope/resolver';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const config: LinterConfig = {
  'version': 1,
  'defaults': {rules: {base: {enabled: true, from: 'defaults'}}},
  'profiles': {
    md: {match: {extension: ['md']}, rules: {base: {from: 'md'}, extra: {enabled: true}}},
    notes: {match: {path: ['notes/**']}, rules: {base: {from: 'notes'}}},
    projects: {match: {path: ['notes/projects/**']}, rules: {base: {from: 'projects'}}},
    tasks: {match: {frontmatter: {type: 'task'}}, rules: {base: {from: 'tasks'}}},
    tagged: {match: {tag: ['work']}, rules: {base: {enabled: false}}},
    manual: {rules: {base: {from: 'manual'}}},
  },
  'note-types': {
    task: {match: {frontmatter: {type: 'task'}}},
    project: {match: {frontmatter: {type: 'project'}}},
  },
};

const inputs: FileFacts[] = [
  {path: 'a.txt', frontmatter: null},
  {path: 'a.md', frontmatter: null},
  {path: 'notes/a.md', frontmatter: null},
  {path: 'notes/projects/a.md', frontmatter: null},
  {path: 'notes/projects/a.md', frontmatter: 'type: task'},
  {path: 'notes/a.md', frontmatter: 'tags:\n  - work'},
  {path: 'notes/a.md', frontmatter: 'type: task\ntags:\n  - work'},
  {path: 'b.md', frontmatter: 'linter-profile: manual'},
  {path: 'b.md', frontmatter: 'linter-profile: missing'},
  {path: 'b.md', frontmatter: 'type: [broken'},
  {path: 'x/y/z/deep.md', frontmatter: 'type: project'},
];

describe('resolveProfile determinism', () => {
  it('100 shuffled runs over the same inputs produce identical output', () => {
    const baseline = new Map<FileFacts, string>(
        inputs.map((facts) => [facts, JSON.stringify(resolveProfile(facts, config))]),
    );
    const rand = mulberry32(0xf02);
    for (let run = 0; run < 100; run++) {
      for (const facts of shuffled(inputs, rand)) {
        expect(JSON.stringify(resolveProfile(facts, config))).toBe(baseline.get(facts));
      }
    }
  });

  it('a structurally identical fresh config resolves identically (cache is invisible)', () => {
    const clone = JSON.parse(JSON.stringify(config)) as LinterConfig;
    for (const facts of inputs) {
      expect(resolveProfile(facts, clone)).toEqual(resolveProfile(facts, config));
    }
  });
});
