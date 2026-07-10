import {
  LinterConfig,
  getRules,
  lintText,
  registerAllRules,
  registerExampleProductProvider,
} from '../../src/index';

const BUILT_IN_RULE_IDS = [
  'join-paragraph-lines',
  'strip-strong',
  'replace-em-dash',
  'prose-list-to-sentences',
  'prose-list-to-sentences-fix',
  'note-type-insert-keys',
  'note-type-key-sort',
  'note-type-date-keys',
  'note-type-validate',
  'h1-matches-stem',
  'kebab-case-filename',
];

beforeAll(() => registerAllRules());

describe('registerAllRules', () => {
  it('registers every built-in rule', () => {
    const ids = getRules().map((r) => r.id);
    for (const id of BUILT_IN_RULE_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('is a no-op on a second call', () => {
    const before = getRules().length;
    registerAllRules();
    expect(getRules().length).toBe(before);
  });
});

describe('lintText', () => {
  it('changes nothing under a config that enables no rules', () => {
    const config: LinterConfig = {version: 1};
    const result = lintText({text: 'Some **bold** text.\n', path: 'a.md', config});
    expect(result.changed).toBe(false);
    expect(result.text).toBe('Some **bold** text.\n');
    expect(result.violations).toEqual([]);
    expect(result.profileChain).toEqual(['defaults']);
    expect(result.noteType).toBeUndefined();
  });

  it('runs a content rule enabled in defaults', () => {
    const config: LinterConfig = {
      version: 1,
      defaults: {rules: {'strip-strong': {enabled: true}}},
    };
    const result = lintText({text: 'Some **bold** text.\n', path: 'a.md', config});
    expect(result.text).toBe('Some bold text.\n');
    expect(result.changed).toBe(true);
    expect(result.violations).toEqual([
      expect.objectContaining({rule: 'strip-strong', fixed: true}),
    ]);
  });

  it('applies a path-matched profile over defaults', () => {
    const config: LinterConfig = {
      version: 1,
      defaults: {rules: {'strip-strong': {enabled: false}}},
      profiles: {
        notes: {
          match: {path: ['notes/**']},
          rules: {'strip-strong': {enabled: true}},
        },
      },
    };
    const inNotes = lintText({text: '**bold**\n', path: 'notes/a.md', config});
    expect(inNotes.text).toBe('bold\n');
    expect(inNotes.profileChain).toEqual(['defaults', 'notes']);

    const outside = lintText({text: '**bold**\n', path: 'other/a.md', config});
    expect(outside.changed).toBe(false);
    expect(outside.profileChain).toEqual(['defaults']);
  });

  it('threads the resolved note-type schema and today into note-type rules', () => {
    const config: LinterConfig = {
      'version': 1,
      'defaults': {
        rules: {
          'note-type-insert-keys': {enabled: true},
          'note-type-date-keys': {enabled: true},
        },
      },
      'note-types': {
        task: {
          'match': {frontmatter: {type: 'task'}},
          'required': {status: 'NEW'},
          'key-order': ['type', 'status'],
          'date-keys': {created: 'date-created', revised: 'date-revised'},
        },
      },
    };
    const result = lintText({
      text: '---\ntype: task\n---\nBody.\n',
      path: 'tasks/t.md',
      config,
      today: '2026-07-10',
    });
    expect(result.noteType).toBe('task');
    expect(result.text).toContain('status: NEW');
    expect(result.text).toContain('date-created: 2026-07-10');
    expect(result.text).toContain('date-revised: 2026-07-10');

    const second = lintText({text: result.text, path: 'tasks/t.md', config, today: '2026-07-10'});
    expect(second.changed).toBe(false);
    expect(second.text).toBe(result.text);
  });

  it('writes no date keys when the caller provides no today', () => {
    const config: LinterConfig = {
      'version': 1,
      'defaults': {
        rules: {
          'note-type-insert-keys': {enabled: true},
          'note-type-date-keys': {enabled: true},
        },
      },
      'note-types': {
        task: {
          'match': {frontmatter: {type: 'task'}},
          'required': {status: 'NEW'},
          'date-keys': {created: 'date-created', revised: 'date-revised'},
        },
      },
    };
    const result = lintText({text: '---\ntype: task\n---\nBody.\n', path: 't.md', config});
    expect(result.text).toContain('status: NEW');
    expect(result.text).not.toContain('date-created');
    expect(result.text).not.toContain('date-revised');
  });

  it('bumps date-revised when an earlier content rule changed the body', () => {
    const config: LinterConfig = {
      'version': 1,
      'defaults': {
        rules: {
          'strip-strong': {enabled: true},
          'note-type-date-keys': {enabled: true},
        },
      },
      'note-types': {
        task: {
          'match': {frontmatter: {type: 'task'}},
          'date-keys': {revised: 'date-revised'},
        },
      },
    };
    const dirty = lintText({
      text: '---\ntype: task\n---\n**Bold** body.\n',
      path: 't.md',
      config,
      today: '2026-07-10',
    });
    expect(dirty.text).toContain('Bold body.');
    expect(dirty.text).toContain('date-revised: 2026-07-10');

    const clean = lintText({
      text: '---\ntype: task\n---\nBold body.\n',
      path: 't.md',
      config,
      today: '2026-07-10',
    });
    expect(clean.changed).toBe(false);
    expect(clean.text).toBe('---\ntype: task\n---\nBold body.\n');
  });

  it('rule options from config reach the rule alongside injected ones', () => {
    const config: LinterConfig = {
      version: 1,
      defaults: {rules: {'strip-strong': {'enabled': true, 'keep-heading-strong': true}}},
    };
    const result = lintText({
      text: '## A **bold** heading\n\nbody **bold** text\n',
      path: 'a.md',
      config,
    });
    expect(result.text).toBe('## A **bold** heading\n\nbody bold text\n');
  });
});

describe('lintText with a provider', () => {
  beforeAll(() => {
    expect(registerExampleProductProvider()).toEqual({ok: true});
  });

  it('runs provider rules with provider defaults and resolves provider note types', () => {
    const config: LinterConfig = {version: 1};
    const result = lintText({text: '---\ntype: epic\n---\nBody.\n', path: 'p/e.md', config});
    expect(result.noteType).toBe('epic');
    expect(result.changed).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({rule: 'product/epic-requires-parent-project', fixed: false}),
    ]);
  });

  it('lets linter.yaml disable a provider rule via its namespace stanza', () => {
    const config: LinterConfig = {
      version: 1,
      providers: {product: {rules: {'epic-requires-parent-project': {enabled: false}}}},
    };
    const result = lintText({text: '---\ntype: epic\n---\nBody.\n', path: 'p/e.md', config});
    expect(result.violations).toEqual([]);
  });

  it('threads provider note-type schemas into built-in note-type rules', () => {
    const config: LinterConfig = {
      version: 1,
      defaults: {rules: {'note-type-insert-keys': {enabled: true}}},
    };
    const result = lintText({
      text: '---\ntype: epic\nparent-project: alpha\n---\nBody.\n',
      path: 'p/e.md',
      config,
    });
    expect(result.noteType).toBe('epic');
    expect(result.text).toContain('status: NEW');
    expect(result.violations).toEqual([
      expect.objectContaining({rule: 'note-type-insert-keys', fixed: true}),
    ]);
  });

  it('lets a file note-type override a provider note-type of the same name', () => {
    const config: LinterConfig = {
      'version': 1,
      'defaults': {rules: {'note-type-insert-keys': {enabled: true}}},
      'note-types': {
        epic: {
          match: {frontmatter: {type: 'epic'}},
          required: {status: 'TRIAGE'},
        },
      },
    };
    const result = lintText({
      text: '---\ntype: epic\nparent-project: alpha\n---\nBody.\n',
      path: 'p/e.md',
      config,
    });
    expect(result.text).toContain('status: TRIAGE');
  });
});
