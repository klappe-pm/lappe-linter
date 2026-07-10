import {CoreRule} from '../rule';
import {consumeFenceLine, createFenceState} from './masking';
import {pathStem} from './path-stem';

function frontmatterEnd(lines: string[]): number {
  if (lines[0]?.replace(/\r$/, '') !== '---') {
    return 0;
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, '') === '---') {
      return i + 1;
    }
  }
  return 0;
}

/**
 * Rewrite the first H1 after frontmatter to the file's stem, or insert one
 * (blank-line separated) when the body has none. Content before the first H1
 * is preserved; only a conflicting H1 line itself changes. No-op without
 * ctx.path. Supersedes upstream file-name-heading; the plugin disables that
 * rule via disableConflictingOptions when this one is enabled.
 */
export const h1MatchesStemRule: CoreRule = {
  id: 'h1-matches-stem',
  category: 'filename',
  description: 'First H1 must match the filename stem; it is rewritten in place or inserted after frontmatter.',
  apply: (text, _options, ctx) => {
    const path = ctx?.path;
    if (!path) {
      return text;
    }
    const heading = `# ${pathStem(path)}`;
    const lines = text.split('\n');
    const fmEnd = frontmatterEnd(lines);

    const fence = createFenceState();
    for (let i = fmEnd; i < lines.length; i++) {
      const line = lines[i].replace(/\r$/, '');
      const wasInFence = fence.open !== null;
      const isDelimiter = consumeFenceLine(line, fence);
      if (wasInFence || isDelimiter) {
        continue;
      }
      if (/^#($|[ \t])/.test(line)) {
        if (line === heading) {
          return text;
        }
        lines[i] = heading;
        return lines.join('\n');
      }
    }

    const head = lines.slice(0, fmEnd);
    const body = lines.slice(fmEnd);
    const out = fmEnd > 0 ? [...head, '', heading] : [heading];
    if (body.length === 0) {
      return out.join('\n');
    }
    if (body[0].replace(/\r$/, '') !== '') {
      out.push('');
    }
    out.push(...body);
    return out.join('\n');
  },
};
