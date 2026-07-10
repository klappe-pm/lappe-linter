/**
 * Content rules barrel (F05). Registration is explicit: the integrator calls
 * registerContentRules() once at wiring time. Registering never enables a
 * rule; enablement comes only from resolved config (`enabled: true`).
 */

import {registerRule} from '../rule';
import {joinParagraphLines} from './join-paragraph-lines';
import {proseListToSentences, proseListToSentencesFix} from './prose-list-to-sentences';
import {replaceEmDash} from './replace-em-dash';
import {stripStrong} from './strip-strong';

export function registerContentRules(): void {
  registerRule(joinParagraphLines);
  registerRule(stripStrong);
  registerRule(replaceEmDash);
  registerRule(proseListToSentences);
  registerRule(proseListToSentencesFix);
}

export {joinParagraphLines} from './join-paragraph-lines';
export {proseListToSentences, proseListToSentencesFix} from './prose-list-to-sentences';
export {replaceEmDash, EM_DASH, EN_DASH} from './replace-em-dash';
export {stripStrong} from './strip-strong';
export {
  computeIgnoreZones,
  inZone,
  isLineBlockMasked,
  lineSpans,
  replaceOutsideZones,
} from './ignore-zones';
export type {IgnoreZone, IgnoreZoneKind, LineSpan} from './ignore-zones';
