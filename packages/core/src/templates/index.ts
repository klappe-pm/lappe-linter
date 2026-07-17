/**
 * Property-based template subsystem (F-templates). Pure and Obsidian-free:
 * global base template -> property-scoped children with per-scope toggles,
 * resolved for one file and rendered to note text. The Obsidian preview, the
 * CLI `template` commands, and any other surface consume this same core.
 */
export * from './types';
export {resolveTemplate} from './resolve';
export {renderTemplate} from './render';
