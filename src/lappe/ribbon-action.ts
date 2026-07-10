/**
 * Decision logic for the ribbon quick action (F02). The editor lint command
 * only runs with an active markdown editor in editing mode; this resolves
 * what the ribbon should do instead when that command's check fails, so the
 * click never silently does nothing. Pure so it is unit-testable without the
 * Obsidian module.
 */

export interface RibbonTargetFile {
  extension: string;
}

export type RibbonFallback = 'done' | 'lint-file' | 'notice';

export function ribbonFallback(editorCommandRan: boolean, file: RibbonTargetFile | null, additionalFileExtensions: string[]): RibbonFallback {
  if (editorCommandRan) {
    return 'done';
  }
  if (file != null && (file.extension === 'md' || additionalFileExtensions.includes(file.extension))) {
    return 'lint-file';
  }
  return 'notice';
}
