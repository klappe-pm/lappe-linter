import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {enforcePinnedKeys, extractRawFrontmatter, frontmatterKeys, stemOf} from '../src/lappe/template-service';

describe('template-service pure helpers', () => {
  describe('extractRawFrontmatter', () => {
    it('returns the frontmatter body without fences', () => {
      expect(extractRawFrontmatter('---\ndomain: x\ntype: task\n---\n\n# Body')).toBe('domain: x\ntype: task');
    });
    it('returns null when there is no frontmatter', () => {
      expect(extractRawFrontmatter('# Just a body')).toBeNull();
    });
  });

  describe('frontmatterKeys', () => {
    it('collects the top-level keys', () => {
      expect([...frontmatterKeys('domain: x\ndate-created: 2026-01-01')]).toEqual(['domain', 'date-created']);
    });
    it('is empty for null frontmatter', () => {
      expect(frontmatterKeys(null).size).toBe(0);
    });
  });

  describe('enforcePinnedKeys (DEC-104)', () => {
    const frontmatter = {domain: 'work', category: 'ops', type: 'task'};

    it('adds only the missing pinned keys, preserving existing values and body', () => {
      const text = '---\ndomain: mine\n---\n\n# Real body\n\nAuthored content.';
      const result = enforcePinnedKeys(text, ['domain', 'category', 'type'], frontmatter);
      expect(result.added).toEqual(['category', 'type']);
      // The author's domain value is untouched; the body is intact.
      expect(result.text).toContain('domain: mine');
      expect(result.text).not.toContain('domain: work');
      expect(result.text).toContain('# Real body');
      expect(result.text).toContain('Authored content.');
      expect(result.text).toContain('category: ops');
      expect(result.text).toContain('type: task');
    });

    it('never overwrites a value the note already set', () => {
      const text = '---\ndomain: mine\ncategory: theirs\ntype: note\n---\nbody';
      const result = enforcePinnedKeys(text, ['domain', 'category', 'type'], frontmatter);
      expect(result.added).toEqual([]);
      expect(result.text).toBe(text);
    });

    it('prepends a fresh frontmatter block when the note has none, keeping the body', () => {
      const text = '# Heading only\n\ntext';
      const result = enforcePinnedKeys(text, ['domain'], frontmatter);
      expect(result.added).toEqual(['domain']);
      expect(result.text.startsWith('---\ndomain: work\n---\n')).toBe(true);
      expect(result.text).toContain('# Heading only');
    });

    it('ignores pinned keys that the resolved template does not define', () => {
      const text = '---\ndomain: mine\n---\nbody';
      const result = enforcePinnedKeys(text, ['domain', 'not-in-template'], frontmatter);
      expect(result.added).toEqual([]);
    });
  });

  describe('stemOf', () => {
    it('drops the folder and .md extension', () => {
      expect(stemOf('Projects/sub/my-note.md')).toBe('my-note');
      expect(stemOf('flat')).toBe('flat');
    });
  });
});

describe('preview view exposes a base-template mode', () => {
  const source = readFileSync(resolve(__dirname, '../src/ui/lappe-preview-view.ts'), 'utf8');
  it('renders both linter and base-template modes with the resolved template metadata', () => {
    expect(source).toContain('type PreviewMode =');
    expect(source).toContain('Base template');
    expect(source).toContain('renderBaseTemplate');
    expect(source).toContain('Inheritance chain');
    expect(source).toContain('Pinned keys');
    expect(source).toContain('resolveNamed');
    // The linter mode contract from the original test still holds.
    expect(source).toContain('extends ItemView');
    expect(source).toContain('Current settings');
    expect(source).not.toContain('extends Modal');
  });
});
