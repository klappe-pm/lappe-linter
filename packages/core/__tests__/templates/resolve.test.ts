import {resolveTemplate} from '../../src/templates/resolve';
import {FileFacts, LinterConfig, TemplatesConfig} from '../../src/config/types';

function config(templates?: TemplatesConfig): LinterConfig {
  return {version: 1, templates};
}

function facts(path: string, frontmatter: string | null = null): FileFacts {
  return {path, frontmatter, today: '2026-07-17'};
}

describe('resolveTemplate', () => {
  it('returns null when there is no templates block', () => {
    expect(resolveTemplate(facts('a.md'), config())).toBeNull();
    expect(resolveTemplate(facts('a.md'), config({}))).toBeNull();
  });

  it('applies the global base when no scope matches', () => {
    const resolved = resolveTemplate(
        facts('Inbox/a.md'),
        config({
          'global': {'frontmatter': {domain: 'general'}, 'pinned-keys': ['domain'], 'body': '# {{title}}'},
          'by-scope': [{name: 'projects', match: {path: ['Projects/**']}}],
        }),
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.name).toBeNull();
    expect(resolved!.chain).toEqual(['global']);
    expect(resolved!.frontmatter).toEqual({domain: 'general'});
    expect(resolved!.pinnedKeys).toEqual(['domain']);
  });

  it('lets the matching scoped template refine the global base', () => {
    const resolved = resolveTemplate(
        facts('Projects/new.md'),
        config({
          'global': {frontmatter: {domain: 'general', status: 'NEW'}},
          'by-scope': [
            {name: 'projects', match: {path: ['Projects/**']}, frontmatter: {domain: 'product', project: []}},
          ],
        }),
    );
    expect(resolved!.name).toBe('projects');
    expect(resolved!.chain).toEqual(['global', 'projects']);
    // scoped domain overrides global; global status is inherited; scoped-only key added
    expect(resolved!.frontmatter).toEqual({domain: 'product', status: 'NEW', project: []});
  });

  it('drops a toggled-off attribute from frontmatter and unpins it', () => {
    const resolved = resolveTemplate(
        facts('Projects/new.md'),
        config({
          'global': {
            'frontmatter': {domain: 'general', aliases: []},
            'pinned-keys': ['domain', 'aliases'],
          },
          'by-scope': [
            {name: 'projects', match: {path: ['Projects/**']}, toggles: {aliases: 'off'}},
          ],
        }),
    );
    expect(resolved!.frontmatter).toEqual({domain: 'general'});
    expect(resolved!.pinnedKeys).toEqual(['domain']);
  });

  it('prefers the stronger matcher when two scopes apply', () => {
    const resolved = resolveTemplate(
        facts('Projects/new.md', 'type: project'),
        config({
          'global': {},
          'by-scope': [
            {name: 'by-folder', match: {path: ['Projects/**']}},
            {name: 'by-property', match: {frontmatter: {type: 'project'}}},
          ],
        }),
    );
    // frontmatter rank (3) beats path rank (2)
    expect(resolved!.name).toBe('by-property');
  });
});
