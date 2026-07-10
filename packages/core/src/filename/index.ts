import {registerRule} from '../rule';
import {h1MatchesStemRule} from './h1-matches-stem';
import {kebabCaseFilenameRule} from './kebab-case-filename';

export {kebabCaseName, resolveCollision, isReservedStem} from './slugger';
export {pathStem} from './path-stem';
export {rewriteLinks} from './link-rewriter';
export {h1MatchesStemRule} from './h1-matches-stem';
export {kebabCaseFilenameRule, proposeRename, RenameProposal} from './kebab-case-filename';

/** Explicit registration entry point for the F04 filename rules. */
export function registerFilenameRules(): void {
  registerRule(h1MatchesStemRule);
  registerRule(kebabCaseFilenameRule);
}
