import {consumeFenceLine, createFenceState, mapOutsideInlineCode} from './masking';

const WIKILINK_RE = /\[\[([^[\]]+)\]\]/g;
const MD_LINK_RE = /\[([^\]]*)\]\(([^()\s]+)\)/g;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:|^\/\//i;

function renameBase(pathPart: string, renames: Map<string, string>): string | null {
  const slash = pathPart.lastIndexOf('/');
  const dir = slash === -1 ? '' : pathPart.slice(0, slash + 1);
  const base = pathPart.slice(slash + 1);
  const hasExt = /\.md$/i.test(base);
  const stem = hasExt ? base.slice(0, -3) : base;
  const next = renames.get(stem);
  if (next === undefined) {
    return null;
  }
  return `${dir}${next}${hasExt ? '.md' : ''}`;
}

function rewriteWikiInner(inner: string, renames: Map<string, string>): string {
  const pipe = inner.indexOf('|');
  const target = pipe === -1 ? inner : inner.slice(0, pipe);
  const alias = pipe === -1 ? '' : inner.slice(pipe);
  const hash = target.indexOf('#');
  const pathPart = hash === -1 ? target : target.slice(0, hash);
  const anchor = hash === -1 ? '' : target.slice(hash);
  const renamed = renameBase(pathPart, renames);
  return renamed === null ? inner : `${renamed}${anchor}${alias}`;
}

function rewriteMdTarget(target: string, renames: Map<string, string>): string {
  if (SCHEME_RE.test(target)) {
    return target;
  }
  const hash = target.indexOf('#');
  const pathPart = hash === -1 ? target : target.slice(0, hash);
  const anchor = hash === -1 ? '' : target.slice(hash);
  if (!/\.md$/i.test(pathPart)) {
    return target;
  }
  let decoded = pathPart;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    decoded = pathPart;
  }
  const renamed = renameBase(decoded, renames);
  return renamed === null ? target : `${encodeURI(renamed)}${anchor}`;
}

function rewriteSegment(segment: string, renames: Map<string, string>): string {
  return segment
      .replace(WIKILINK_RE, (whole, inner: string) => {
        const next = rewriteWikiInner(inner, renames);
        return next === inner ? whole : `[[${next}]]`;
      })
      .replace(MD_LINK_RE, (whole, label: string, target: string) => {
        const next = rewriteMdTarget(target, renames);
        return next === target ? whole : `[${label}](${next})`;
      });
}

/**
 * Rewrite wikilinks (plain, aliased, heading-anchored), embeds, and relative
 * markdown links ending in `.md` per a stem-to-stem rename map. Code fences
 * and inline code are never touched. Used by the CLI rename mode (F06); the
 * plugin relies on Obsidian's own link updater instead.
 */
export function rewriteLinks(text: string, renames: Map<string, string>): string {
  if (renames.size === 0) {
    return text;
  }
  const fence = createFenceState();
  return text
      .split('\n')
      .map((rawLine) => {
        const line = rawLine.replace(/\r$/, '');
        const wasInFence = fence.open !== null;
        const isDelimiter = consumeFenceLine(line, fence);
        if (wasInFence || isDelimiter) {
          return rawLine;
        }
        return mapOutsideInlineCode(rawLine, (segment) => rewriteSegment(segment, renames));
      })
      .join('\n');
}
