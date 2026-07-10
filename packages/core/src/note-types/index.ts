import {getRule, registerRule} from '../rule';
import {noteTypeDateKeys} from './note-type-date-keys';
import {noteTypeInsertKeys} from './note-type-insert-keys';
import {noteTypeKeySort} from './note-type-key-sort';
import {noteTypeValidate} from './note-type-validate';
import {yamlKeySort} from './yaml-key-sort';
import {yamlTimestamp} from './yaml-timestamp';
import {alphabetizePropertyValues} from './alphabetize-property-values';

export {yamlKeySort} from './yaml-key-sort';
export {yamlTimestamp} from './yaml-timestamp';
export {alphabetizePropertyValues} from './alphabetize-property-values';
export {noteTypeDateKeys} from './note-type-date-keys';
export {noteTypeInsertKeys} from './note-type-insert-keys';
export {noteTypeKeySort} from './note-type-key-sort';
export {collectNoteTypeViolations, noteTypeValidate} from './note-type-validate';
export {starterNoteTypes, STARTER_KEY_ORDER, STARTER_STATUS_VALUES} from './starter-note-types';
export {validateNoteTypes} from './validate-config';

/**
 * Explicit registration, no import side effects. Registry order is the run
 * order: insert defaults, sort keys, manage date keys, then report.
 * Idempotent so plugin and CLI can both call it safely.
 */
export function registerNoteTypeRules(): void {
  for (const rule of [yamlKeySort, alphabetizePropertyValues, yamlTimestamp, noteTypeInsertKeys, noteTypeKeySort, noteTypeDateKeys, noteTypeValidate]) {
    if (!getRule(rule.id)) {
      registerRule(rule);
    }
  }
}
