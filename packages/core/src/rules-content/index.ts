/**
 * Content rules barrel (F05). Registration is explicit: the integrator calls
 * registerContentRules() once at wiring time. Registering never enables a
 * rule; enablement comes only from resolved config (`enabled: true`).
 */

import {registerRule} from '../rule';
import {headerCase} from './header-case';
import {joinParagraphLines} from './join-paragraph-lines';
import {listStyle} from './list-style';
import {paragraphSpacing} from './paragraph-spacing';
import {proseListToSentences, proseListToSentencesFix} from './prose-list-to-sentences';
import {replaceEmDash} from './replace-em-dash';
import {stripStrong} from './strip-strong';

export function registerContentRules(): void {
  registerRule(joinParagraphLines);
  registerRule(stripStrong);
  registerRule(replaceEmDash);
  registerRule(proseListToSentences);
  registerRule(proseListToSentencesFix);
  registerRule(headerCase);
  registerRule(paragraphSpacing);
  registerRule(listStyle);
}

export {headerCase, formatHeadingText, HEADER_CASE_STYLES} from './header-case';
export type {HeaderCaseStyle} from './header-case';
export {listStyle} from './list-style';
export {paragraphSpacing} from './paragraph-spacing';
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
