import {defaultLinterConfig, lintText, registerAllRules} from '@lappe-linter/core';
import {PREVIEW_SAMPLE, PREVIEW_SAMPLE_PATH} from '../src/lappe/preview-sample';

describe('preview sample', () => {
  beforeAll(() => registerAllRules());

  it('lints the sample cleanly and visibly changes it with default config', () => {
    const result = lintText({text: PREVIEW_SAMPLE, path: PREVIEW_SAMPLE_PATH, config: defaultLinterConfig(), today: '2026-07-10'});
    expect(result.text).not.toBe(PREVIEW_SAMPLE);
    // H1 is synced to the file stem and the frontmatter is reordered/timestamped.
    expect(result.text).toContain('# sample-note');
    expect(result.text).toContain('date-revised: 2026-07-10');
  });

  it('is idempotent under the default config', () => {
    const config = defaultLinterConfig();
    const once = lintText({text: PREVIEW_SAMPLE, path: PREVIEW_SAMPLE_PATH, config, today: '2026-07-10'}).text;
    const twice = lintText({text: once, path: PREVIEW_SAMPLE_PATH, config, today: '2026-07-10'}).text;
    expect(twice).toBe(once);
  });
});
