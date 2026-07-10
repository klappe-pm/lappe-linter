/**
 * Public API of @lappe-linter/core. Pure and Obsidian-free by contract: this
 * barrel and everything it re-exports must never bind Obsidian APIs or touch
 * the filesystem. The plugin and the CLI both consume this surface.
 */

import {registerFilenameRules} from './filename';
import {registerNoteTypeRules} from './note-types';
import {registerContentRules} from './rules-content';

export const CORE_VERSION = '1.32.0';

export * from './rule';
export * from './runner';
export * from './config';
export * from './scope';
export * from './rules-content';
export * from './note-types';
export * from './filename';
export * from './providers';
export * from './lint-file';

let allRulesRegistered = false;

/**
 * Register every built-in rule exactly once. Registration order is run order:
 * content transforms first, then note-type frontmatter rules (so date-keys
 * observes content changes), then filename reports. Registering never enables
 * a rule; enablement comes only from resolved config. Providers register
 * separately via registerProvider().
 */
export function registerAllRules(): void {
  if (allRulesRegistered) {
    return;
  }
  registerContentRules();
  registerNoteTypeRules();
  registerFilenameRules();
  allRulesRegistered = true;
}
