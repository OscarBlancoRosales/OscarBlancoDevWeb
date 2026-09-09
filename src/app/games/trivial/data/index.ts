import { DEV_QUESTIONS as DEV_CORE } from './dev';
import { DEV_EXTRA_1 } from './dev-extra-1';
import { DEV_EXTRA_2 } from './dev-extra-2';
import { DEV_EXTRA_3 } from './dev-extra-3';
import { DEV_EXTRA_4 } from './dev-extra-4';
import { DEV_EXTRA_5 } from './dev-extra-5';
import { DEV_EXTRA_6 } from './dev-extra-6';
import { DEV_SECTION_MIX } from './dev-section-mix';
import { uniqueByPrompt, uniqueByStem } from './expand';
import { expandFigshare } from './generated/figshare';
import { expandWikidataDev, expandWikidataGeneral } from './generated/from-facts';
import { GENERAL_QUESTIONS as GENERAL_CORE } from './general';
import { GENERAL_EXTRA_1 } from './general-extra-1';
import { GENERAL_EXTRA_2 } from './general-extra-2';
import { GENERAL_EXTRA_3 } from './general-extra-3';
import { GENERAL_SECTION_MIX } from './general-section-mix';
import { Question, QuestionPack, QuestionType } from './types';

export type { Question, QuestionPack, QuestionType, Difficulty } from './types';
export { DEV_CATEGORIES, GENERAL_CATEGORIES } from './types';
export { normalizePrompt } from './expand';

const DEV_BASE: Question[] = uniqueByPrompt([
  ...DEV_CORE,
  ...DEV_EXTRA_1,
  ...DEV_EXTRA_2,
  ...DEV_EXTRA_3,
  ...DEV_EXTRA_4,
  ...DEV_EXTRA_5,
  ...DEV_EXTRA_6,
  ...DEV_SECTION_MIX,
]);

export const DEV_QUESTIONS: Question[] = uniqueByStem(
  uniqueByPrompt([...DEV_BASE, ...expandWikidataDev(DEV_BASE)]),
);

const GENERAL_BASE: Question[] = uniqueByPrompt([
  ...GENERAL_CORE,
  ...GENERAL_EXTRA_1,
  ...GENERAL_EXTRA_2,
  ...GENERAL_EXTRA_3,
  ...GENERAL_SECTION_MIX,
  ...expandFigshare(),
]);

export const GENERAL_QUESTIONS: Question[] = uniqueByStem(
  uniqueByPrompt([...GENERAL_BASE, ...expandWikidataGeneral(GENERAL_BASE)]),
);

/** Todas las preguntas, dev primero y cultura después. */
export const TRIVIAL_QUESTIONS: Question[] = [...DEV_QUESTIONS, ...GENERAL_QUESTIONS];

export function questionsOfPack(pack: QuestionPack): Question[] {
  return TRIVIAL_QUESTIONS.filter((question) => question.pack === pack);
}

export function questionsOfType(type: QuestionType): Question[] {
  return TRIVIAL_QUESTIONS.filter((question) => question.type === type);
}
