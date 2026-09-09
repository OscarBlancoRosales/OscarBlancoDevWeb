import { Question } from '../types';
import { makeBank, shuffleIn } from '../expand';
import { FIGSHARE_ROWS } from './figshare-rows';

/** Banco de cultura general en español, CC BY 4.0 (Duñabeitia / Figshare). */
export function expandFigshare(): Question[] {
  const q = makeBank('general', 'fs');
  return FIGSHARE_ROWS.map(([category, difficulty, prompt, answer, lure1, lure2, lure3]) => {
    const options = shuffleIn([answer, lure1, lure2, lure3], prompt) as [string, string, string, string];
    return q.c(category, difficulty, prompt, options, answer);
  });
}
