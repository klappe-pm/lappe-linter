import {ribbonFallback} from '../src/lappe/ribbon-action';

describe('ribbon fallback decision', () => {
  it('does nothing more when the editor command ran', () => {
    expect(ribbonFallback(true, {extension: 'md'}, [])).toBe('done');
    expect(ribbonFallback(true, null, [])).toBe('done');
  });

  it('lints the whole file when a markdown file is active but not in an editor', () => {
    expect(ribbonFallback(false, {extension: 'md'}, [])).toBe('lint-file');
  });

  it('honors additional file extensions', () => {
    expect(ribbonFallback(false, {extension: 'txt'}, ['txt'])).toBe('lint-file');
  });

  it('notices when there is no active file', () => {
    expect(ribbonFallback(false, null, [])).toBe('notice');
  });

  it('notices when the active file is not lintable', () => {
    expect(ribbonFallback(false, {extension: 'png'}, [])).toBe('notice');
  });
});
