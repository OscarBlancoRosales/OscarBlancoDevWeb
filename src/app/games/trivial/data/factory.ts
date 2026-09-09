import { Difficulty, Question, QuestionPack } from './types';

/** Atajo para no repetir 8 campos en cada pregunta extra. */
export function bank(pack: QuestionPack, series: string) {
  let n = 0;
  const id = (category: string) =>
    `${pack}-${series}-${category}-${(++n).toString().padStart(3, '0')}`;

  return {
    c(
      category: string,
      difficulty: Difficulty,
      prompt: string,
      options: [string, string, string, string],
      answer: string,
      explain?: string,
    ): Question {
      return { id: id(category), pack, category, type: 'choice', difficulty, prompt, options, answer, explain };
    },
    tf(category: string, difficulty: Difficulty, prompt: string, truth: boolean, explain?: string): Question {
      return {
        id: id(category),
        pack,
        category,
        type: 'truefalse',
        difficulty,
        prompt,
        options: ['Verdadero', 'Falso'],
        answer: truth ? 'Verdadero' : 'Falso',
        explain,
      };
    },
    n(
      category: string,
      difficulty: Difficulty,
      prompt: string,
      answer: number,
      explain?: string,
      tolerance?: number,
    ): Question {
      return { id: id(category), pack, category, type: 'numeric', difficulty, prompt, answer, explain, tolerance };
    },
    odd(
      category: string,
      difficulty: Difficulty,
      prompt: string,
      options: [string, string, string, string],
      answer: string,
      explain?: string,
    ): Question {
      return { id: id(category), pack, category, type: 'odd', difficulty, prompt, options, answer, explain };
    },
    op(
      category: string,
      difficulty: Difficulty,
      prompt: string,
      answer: string,
      accept?: string[],
      explain?: string,
    ): Question {
      return { id: id(category), pack, category, type: 'open', difficulty, prompt, answer, accept, explain };
    },
    ord(
      category: string,
      difficulty: Difficulty,
      prompt: string,
      options: string[],
      answer: string[],
      explain?: string,
    ): Question {
      return { id: id(category), pack, category, type: 'order', difficulty, prompt, options, answer, explain };
    },
  };
}
