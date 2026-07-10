import {RuleViolation} from '@lappe-linter/core';

/**
 * The --json output contract, output-version 1 (F06 R5). One JSON object per
 * line per linted file, stable key order, designed for SQLite ingestion by
 * session-data. Breaking changes bump OUTPUT_VERSION.
 *
 * Semantics: `violations[].fixed` is the core runner's value, whether the
 * rule's transform was applied to the produced text. In check mode the
 * produced text is discarded, so fixed=true there means "auto-fixable".
 * `line` is null when the rule does not report one. `renamed_to` is null
 * except in fix --allow-rename runs that executed a rename.
 */

export const OUTPUT_VERSION = 1;

export interface FileReport {
  /** Config-dir-relative path with forward slashes. */
  path: string;
  /** Last entry of the resolved profile chain. */
  profile: string;
  violations: RuleViolation[];
  renamedTo: string | null;
}

export function jsonLine(report: FileReport): string {
  return `${JSON.stringify({
    'path': report.path,
    'profile': report.profile,
    'violations': report.violations.map((v) => ({
      rule: v.rule,
      line: v.line ?? null,
      message: v.message,
      fixed: v.fixed,
    })),
    'renamed_to': report.renamedTo,
    'output-version': OUTPUT_VERSION,
  })}\n`;
}
