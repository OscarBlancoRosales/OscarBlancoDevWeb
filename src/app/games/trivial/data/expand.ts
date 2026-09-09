import { Difficulty, Question, QuestionPack } from './types';
import { bank } from './factory';

export function normalizePrompt(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function canonPlace(text: string): string {
  return normalizePrompt(text)
    .replace(/^(el|la|los|las|un|una|reino de los|reino de|republica popular|republica de|comunidad de|region de)\s+/g, '')
    .trim();
}

export function stemOf(kind: string, subject: string): string {
  return `${kind}:${canonPlace(subject)}`;
}

export function withStem(question: Question, stem: string): Question {
  return { ...question, stem };
}

/** Recupera el hecho aunque la pregunta se escribiera a mano, sin `stem`. */
export function inferStem(question: Question): string | null {
  if (question.stem) return question.stem;
  const p = normalizePrompt(question.prompt);

  let m = p.match(/capital de (.+)$/);
  if (m) return stemOf('capital', m[1]);
  m = p.match(/nombra la capital de (.+)$/);
  if (m) return stemOf('capital', m[1]);
  m = p.match(/^la capital de (.+) es /);
  if (m) return stemOf('capital', m[1]);

  m = p.match(/moneda( oficial)? de (.+)$/);
  if (m) return stemOf('currency', m[2]);
  m = p.match(/^la moneda de (.+) es /);
  if (m) return stemOf('currency', m[1]);

  m = p.match(/simbolo quimico del (.+)$/);
  if (m) return stemOf('element', m[1]);
  m = p.match(/numero atomico del (.+)$/);
  if (m) return stemOf('element', m[1]);

  if (p.includes('lenguaje')) {
    m = p.match(/lenguaje (.+)$/);
    if (m && /(disen|creo|aparecio|ano|quien)/.test(p)) return stemOf('lang', m[1]);
  }

  m = p.match(/comunidad autonoma pertenece (.+)$/);
  if (m) return stemOf('province', m[1]);

  return null;
}

export function uniqueByPrompt(list: Question[]): Question[] {
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const question of list) {
    const key = normalizePrompt(question.prompt);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(question);
  }
  return out;
}

/** Un hecho, un modo: si ya salió como test, no vuelve como abierta ni V/F. */
export function uniqueByStem(list: Question[]): Question[] {
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const question of list) {
    const stem = inferStem(question);
    if (!stem) {
      out.push(question);
      continue;
    }
    if (seen.has(stem)) continue;
    seen.add(stem);
    out.push(question.stem ? question : { ...question, stem });
  }
  return out;
}

export function takenStems(list: Question[]): Set<string> {
  const taken = new Set<string>();
  for (const question of list) {
    const stem = inferStem(question);
    if (stem) taken.add(stem);
  }
  return taken;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleIn<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let h = hash(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickDistractors(pool: string[], correct: string, seed: string, n = 3): string[] | null {
  const unique = [...new Set(pool.filter((item) => item !== correct))];
  if (unique.length < n) return null;
  return shuffleIn(unique, seed).slice(0, n);
}

type QuizBank = ReturnType<typeof bank>;

export type Pair = readonly [string, string, Difficulty?];

/**
 * Un ítem, un modo. Reparte test / abierta / V-F y no pregunta el mismo
 * término de dos formas.
 */
export function expandMap(
  q: QuizBank,
  category: string,
  items: Pair[],
  choicePrompt: (subject: string) => string,
  openPrompt?: (subject: string) => string,
  kind = 'term',
): Question[] {
  const answers = items.map((item) => item[1]);
  const out: Question[] = [];
  items.forEach(([subject, answer, difficulty], index) => {
    const diff = difficulty ?? 2;
    const stem = stemOf(kind, subject);
    const slot = openPrompt ? index % 3 : index % 2;
    if (slot === 0) {
      const prompt = choicePrompt(subject);
      const lures = pickDistractors(answers, answer, prompt);
      if (!lures) return;
      const options = shuffleIn([answer, ...lures], prompt) as [string, string, string, string];
      out.push(withStem(q.c(category, diff, prompt, options, answer), stem));
      return;
    }
    if (slot === 1 && openPrompt) {
      out.push(withStem(q.op(category, diff, openPrompt(subject), answer), stem));
      return;
    }
    const truth = index % 6 !== 5;
    const shown = truth ? answer : (pickDistractors(answers, answer, subject)?.[0] ?? answer);
    const prompt = `${choicePrompt(subject).replace(/[.…?]+$/, '')}: ${shown}.`;
    out.push(withStem(q.tf(category, diff, prompt, truth && shown === answer), stem));
  });
  return out;
}

export function freeItems<T extends readonly [string, ...unknown[]]>(
  items: T[],
  kind: string,
  taken: Set<string>,
): T[] {
  return items.filter((item) => !taken.has(stemOf(kind, item[0])));
}

export function markStem(kind: string, subject: string, taken: Set<string>): string {
  const stem = stemOf(kind, subject);
  taken.add(stem);
  return stem;
}

export function makeBank(pack: QuestionPack, series: string) {
  return bank(pack, series);
}
