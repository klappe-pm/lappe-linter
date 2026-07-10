/**
 * Minimal code masking shared by the filename rules: fenced-block tracking
 * plus inline-code skipping, so rewrites never touch code. The fence and
 * inline-code definitions are imported from rules-content/ignore-zones so
 * the two surfaces cannot drift apart.
 */

import {FENCE_OPEN, inlineCodeSpans} from '../rules-content/ignore-zones';

const FENCE_RE = FENCE_OPEN;

export interface FenceState {
  open: string | null;
}

export function createFenceState(): FenceState {
  return {open: null};
}

/**
 * Advance the fence state for one line. Returns true when the line is a fence
 * delimiter (opening or closing). Content lines inside an open fence return
 * false but the caller sees `state.open` was set before the call.
 */
export function consumeFenceLine(line: string, state: FenceState): boolean {
  const match = FENCE_RE.exec(line);
  if (state.open !== null) {
    if (match && match[1][0] === state.open[0] && match[1].length >= state.open.length) {
      state.open = null;
      return true;
    }
    return false;
  }
  if (match) {
    state.open = match[1];
    return true;
  }
  return false;
}

/** Apply `fn` to the parts of a line outside inline code spans. */
export function mapOutsideInlineCode(line: string, fn: (segment: string) => string): string {
  let out = '';
  let last = 0;
  for (const [start, end] of inlineCodeSpans(line)) {
    out += fn(line.slice(last, start)) + line.slice(start, end);
    last = end;
  }
  return out + fn(line.slice(last));
}
