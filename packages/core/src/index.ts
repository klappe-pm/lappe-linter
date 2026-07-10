/**
 * Public API of @lappe-linter/core. Pure and Obsidian-free by contract: this
 * barrel and everything it re-exports must never bind Obsidian APIs or touch
 * the filesystem. The plugin and the CLI both consume this surface.
 */

export const CORE_VERSION = '1.32.0';

export * from './rule';
export * from './runner';
export * from './config/types';

// Feature packages register their rules by importing this barrel and calling
// registerRule(). F05 content rules, F03 note-type rules, and F04 filename
// rules attach here; F01 config loader and F02 scope engine land alongside.
