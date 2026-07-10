import {CoreRule} from '../rule';
import {kebabCaseName} from './slugger';
import {pathStem} from './path-stem';

export interface RenameProposal {
  stem: string;
  proposed: string;
}

/**
 * The proposed rename for a path, or null when the stem is already compliant,
 * the slug degenerates to empty, or there is nothing to go on. Plugin and CLI
 * build their user-facing rename messages and executors from this.
 */
export function proposeRename(path: string | undefined): RenameProposal | null {
  if (!path) {
    return null;
  }
  const stem = pathStem(path);
  const proposed = kebabCaseName(stem);
  if (proposed === '' || proposed === stem) {
    return null;
  }
  return {stem, proposed};
}

/**
 * Report-only: flags a stem that is not kebab-case and names the proposed
 * replacement. The runner discards the returned text for reportOnly rules, so
 * the appended trailer only signals the violation; rename execution and the
 * detailed message live plugin/CLI-side via `proposeRename`.
 */
export const kebabCaseFilenameRule: CoreRule = {
  id: 'kebab-case-filename',
  category: 'filename',
  description: 'Flag filenames that are not kebab-case and propose the compliant name; the rename runs only where rename mode allows it.',
  reportOnly: true,
  apply: (text, _options, ctx) => {
    const proposal = proposeRename(ctx?.path);
    if (!proposal) {
      return text;
    }
    const separator = text.endsWith('\n') || text === '' ? '' : '\n';
    return `${text}${separator}<!-- lappe-linter kebab-case-filename: rename "${proposal.stem}" to "${proposal.proposed}" -->\n`;
  },
};
