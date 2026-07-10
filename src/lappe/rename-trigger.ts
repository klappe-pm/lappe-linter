/**
 * Decide whether a vault rename should trigger a lint pass (F headers). The
 * goal is to format a note the moment the user first names it: Obsidian
 * creates new notes as "Untitled" (or "Untitled 1", ...), so a rename away
 * from that default to a real markdown name is the "just named it" signal.
 * Renames between two real names are left to explicit lint commands so we do
 * not re-format on every reorganization. Pure so the rule is unit-tested.
 */

const UNTITLED = /^Untitled(?: \d+)?$/;

function stem(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith('.md');
}

export function shouldLintOnRename(oldPath: string, newPath: string): boolean {
  if (!isMarkdownPath(newPath)) {
    return false;
  }
  const newStem = stem(newPath);
  if (UNTITLED.test(newStem)) {
    return false;
  }
  return UNTITLED.test(stem(oldPath));
}
