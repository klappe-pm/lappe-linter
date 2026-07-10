/**
 * Move the item at `from` to sit at position `to` in a copy of the array.
 * Used by the drag-and-drop key-sort list; kept pure so the reorder math is
 * unit-tested without a DOM. Out-of-range or no-op moves return a copy
 * unchanged.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const out = [...items];
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) {
    return out;
  }
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved);
  return out;
}
