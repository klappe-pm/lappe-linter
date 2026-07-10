import {parseLinterConfig} from '../../src/config/loader';
import {updateConfigText} from '../../src/config/serializer';

const INPUT = `# header comment: this file is hand-tended
version: 1
defaults:
  rules:
    yaml-key-sort:
      enabled: true # keep sorted
custom-unknown-key: keep-me # unknown but preserved
`;

describe('updateConfigText', () => {
  it('round-trips a no-op mutation byte-identically', () => {
    expect(updateConfigText(INPUT, () => {})).toBe(INPUT);
  });

  it('applies an edit while preserving comments and unknown keys', () => {
    const output = updateConfigText(INPUT, (doc) => {
      doc.setIn(['defaults', 'rules', 'yaml-key-sort', 'enabled'], false);
    });
    expect(output).toContain('# header comment: this file is hand-tended');
    expect(output).toContain('enabled: false # keep sorted');
    expect(output).toContain('custom-unknown-key: keep-me # unknown but preserved');
    const reparsed = parseLinterConfig(output);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.config.defaults?.rules?.['yaml-key-sort']?.enabled).toBe(false);
  });

  it('can add new keys without disturbing existing content', () => {
    const output = updateConfigText(INPUT, (doc) => {
      doc.setIn(['rename', 'mode'], 'flag');
    });
    expect(output).toContain('# header comment: this file is hand-tended');
    expect(output).toContain('custom-unknown-key: keep-me');
    const reparsed = parseLinterConfig(output);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.config.rename?.mode).toBe('flag');
  });

  it('throws on malformed yaml instead of corrupting it', () => {
    expect(() => updateConfigText('a: [\n', () => {})).toThrow(/malformed yaml/);
  });
});
