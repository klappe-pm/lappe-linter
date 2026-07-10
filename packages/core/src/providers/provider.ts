import {CoreRule} from '../rule';
import {NoteTypeSchema} from '../config/types';

/**
 * The provider API version this core speaks. Providers built against a
 * different major version are skipped with a logged warning, never a crash
 * (F08 R2). Breaking this contract requires a major version bump (F08 R5).
 */
export const API_VERSION = 1 as const;

/**
 * An external rule provider (F08): the no-fork extension surface that lets
 * another package (e.g. the product-management plugin) contribute rules and
 * note-type schemas that behave identically to built-ins. Providers stay as
 * pure as core rules: no Obsidian imports, no filesystem access.
 */
export interface RuleProvider {
  /** Stable kebab-case provider identifier, unique across providers. */
  id: string;
  /** Must equal API_VERSION for the provider to be accepted. */
  apiVersion: 1;
  /**
   * Namespace for this provider's config and rule ids. Rules register as
   * `<configNamespace>/<rule-id>` and configure under
   * `providers.<configNamespace>.rules` in linter.yaml.
   */
  configNamespace: string;
  /** Rules to contribute, with bare (unprefixed) ids. */
  rules(): CoreRule[];
  /** Note-type schemas to contribute, keyed by note-type name. */
  noteTypes(): Record<string, NoteTypeSchema>;
}
