import {
  computeIgnoreZones,
  EM_DASH,
  inZone,
  isLineBlockMasked,
  lineSpans,
} from '../../src/rules-content';

function kindsOf(text: string): string[] {
  return computeIgnoreZones(text).map((z) => z.kind);
}

describe('computeIgnoreZones', () => {
  it('masks YAML frontmatter from the first line', () => {
    const text = '---\ntitle: "**x**"\n---\n\nbody **bold**\n';
    const zones = computeIgnoreZones(text);
    const fm = zones.find((z) => z.kind === 'frontmatter');
    expect(fm).toBeDefined();
    expect(fm!.start).toBe(0);
    expect(text.slice(fm!.start, fm!.end)).toBe('---\ntitle: "**x**"\n---');
    expect(inZone(zones, text.indexOf('**x**'))).toBe(true);
    expect(inZone(zones, text.indexOf('**bold**'))).toBe(false);
  });

  it('does not treat a mid-document ruler as frontmatter', () => {
    const text = 'para\n\n---\n\nafter\n';
    expect(kindsOf(text)).not.toContain('frontmatter');
  });

  it('masks fenced code including unclosed fences', () => {
    const closed = 'a\n```js\ncode ' + EM_DASH + ' **b**\n```\nz **real**\n';
    const zones = computeIgnoreZones(closed);
    expect(inZone(zones, closed.indexOf('**b**'))).toBe(true);
    expect(inZone(zones, closed.indexOf('**real**'))).toBe(false);

    const unclosed = 'a\n```\ndangling ' + EM_DASH + '\n';
    const z2 = computeIgnoreZones(unclosed);
    expect(inZone(z2, unclosed.indexOf(EM_DASH))).toBe(true);
  });

  it('masks tilde fences and respects fence length', () => {
    const text = '~~~~\ninner ```\nstill code\n~~~~\nout\n';
    const zones = computeIgnoreZones(text);
    expect(inZone(zones, text.indexOf('still code'))).toBe(true);
    expect(inZone(zones, text.indexOf('out'))).toBe(false);
  });

  it('masks math blocks and inline math', () => {
    const text = '$$\nx = y ' + EM_DASH + ' z\n$$\n\nprose $a' + EM_DASH + 'b$ more\n';
    const zones = computeIgnoreZones(text);
    expect(inZone(zones, text.indexOf('x = y'))).toBe(true);
    expect(inZone(zones, text.indexOf('$a'))).toBe(true);
    expect(inZone(zones, text.indexOf('more'))).toBe(false);
  });

  it('does not treat dollar amounts as inline math', () => {
    const text = 'it costs $5 and $10 total\n';
    expect(kindsOf(text)).toEqual([]);
  });

  it('masks inline code spans including multi-backtick spans', () => {
    const text = 'use `a ' + EM_DASH + ' b` and ``x ` y`` here\n';
    const zones = computeIgnoreZones(text);
    expect(inZone(zones, text.indexOf(EM_DASH))).toBe(true);
    expect(inZone(zones, text.indexOf('x ` y'))).toBe(true);
    expect(inZone(zones, text.indexOf('here'))).toBe(false);
  });

  it('masks pipe tables as whole-line block zones', () => {
    const text = '| a | b |\n| - | - |\n| c ' + EM_DASH + ' d | **e** |\n\nafter\n';
    const zones = computeIgnoreZones(text);
    const lines = lineSpans(text);
    expect(isLineBlockMasked(zones, lines[0])).toBe(true);
    expect(isLineBlockMasked(zones, lines[2])).toBe(true);
    expect(isLineBlockMasked(zones, lines[4])).toBe(false);
  });

  it('masks wikilinks, embeds, and URLs', () => {
    const text =
      'see [[Note ' + EM_DASH + ' One]] and ![[img.png]] at https://x.io/a' + EM_DASH + 'b end\n';
    const zones = computeIgnoreZones(text);
    expect(inZone(zones, text.indexOf('Note'))).toBe(true);
    expect(inZone(zones, text.indexOf('img.png'))).toBe(true);
    expect(inZone(zones, text.indexOf('/a'))).toBe(true);
    expect(inZone(zones, text.indexOf('end'))).toBe(false);
  });

  it('masks markdown link destinations', () => {
    const text = 'a [label **x**](https://y.io/p_q_r) tail **bold**\n';
    const zones = computeIgnoreZones(text);
    expect(inZone(zones, text.indexOf('p_q_r'))).toBe(true);
    expect(inZone(zones, text.indexOf('**x**'))).toBe(false);
    expect(inZone(zones, text.indexOf('**bold**'))).toBe(false);
  });

  it('masks indented code blocks', () => {
    const text = 'para\n\n    indented ' + EM_DASH + ' code\n\nafter\n';
    const zones = computeIgnoreZones(text);
    expect(inZone(zones, text.indexOf('indented'))).toBe(true);
    expect(inZone(zones, text.indexOf('after'))).toBe(false);
  });

  it('does not mask a dollar sign inside inline code as math spilling out', () => {
    const text = 'mix `a$b` c$d here\n';
    const zones = computeIgnoreZones(text);
    expect(inZone(zones, text.indexOf('here'))).toBe(false);
  });
});
