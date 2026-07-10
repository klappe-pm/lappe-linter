/** Basename of a vault-relative path minus a trailing `.md` extension. */
export function pathStem(path: string): string {
  const segments = path.split(/[/\\]/);
  const base = segments[segments.length - 1] ?? path;
  return /\.md$/i.test(base) ? base.slice(0, -3) : base;
}
