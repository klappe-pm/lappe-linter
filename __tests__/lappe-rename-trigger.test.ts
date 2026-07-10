import {shouldLintOnRename} from '../src/lappe/rename-trigger';

describe('shouldLintOnRename', () => {
  it('lints when a new Untitled note is first given a real name', () => {
    expect(shouldLintOnRename('Untitled.md', 'My New Note.md')).toBe(true);
    expect(shouldLintOnRename('Untitled 3.md', 'notes/Real Name.md')).toBe(true);
  });

  it('does not lint while the note is still Untitled', () => {
    expect(shouldLintOnRename('Untitled.md', 'Untitled 1.md')).toBe(false);
  });

  it('does not lint a rename between two real names', () => {
    expect(shouldLintOnRename('old-name.md', 'new-name.md')).toBe(false);
  });

  it('ignores non-markdown targets', () => {
    expect(shouldLintOnRename('Untitled.md', 'Untitled.png')).toBe(false);
    expect(shouldLintOnRename('Untitled.canvas', 'diagram.canvas')).toBe(false);
  });

  it('does not treat names that merely start with Untitled as default', () => {
    expect(shouldLintOnRename('Untitled Thoughts.md', 'renamed.md')).toBe(false);
  });
});
