import { describe, expect, it } from 'vitest';
import { inferStem } from './expand';
import {
  DEV_CATEGORIES,
  DEV_QUESTIONS,
  GENERAL_CATEGORIES,
  GENERAL_QUESTIONS,
  TRIVIAL_QUESTIONS,
  normalizePrompt,
  questionsOfPack,
  questionsOfType,
} from './index';
import { Question, QuestionType } from './types';

const TYPES: QuestionType[] = ['choice', 'truefalse', 'numeric', 'odd', 'order', 'open'];

function idsOf(list: Question[]): string[] {
  return list.map((question) => question.id);
}

describe('banco de preguntas del trivial', () => {
  it('tiene un buen puñado de preguntas, partidas en dos packs', () => {
    expect(DEV_QUESTIONS.length).toBeGreaterThanOrEqual(400);
    expect(GENERAL_QUESTIONS.length).toBeGreaterThanOrEqual(1500);
    expect(TRIVIAL_QUESTIONS.length).toBe(DEV_QUESTIONS.length + GENERAL_QUESTIONS.length);
    expect(questionsOfPack('dev')).toHaveLength(DEV_QUESTIONS.length);
    expect(questionsOfPack('general')).toHaveLength(GENERAL_QUESTIONS.length);
  });

  it('ningún id se repite', () => {
    const ids = idsOf(TRIVIAL_QUESTIONS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ningún enunciado se repite (da igual tildes y mayúsculas)', () => {
    const seen = new Map<string, string>();
    for (const question of TRIVIAL_QUESTIONS) {
      const key = normalizePrompt(question.prompt);
      const previous = seen.get(key);
      expect(previous, `repetida: «${question.id}» y «${previous}»`).toBeUndefined();
      seen.set(key, question.id);
    }
  });

  it('cubre los seis tipos de prueba', () => {
    for (const type of TYPES) {
      expect(questionsOfType(type).length, type).toBeGreaterThan(0);
    }
  });

  it('cada sección de ambos packs tiene los seis tipos de ronda', () => {
    const packs = [
      { name: 'dev' as const, categories: DEV_CATEGORIES, list: DEV_QUESTIONS },
      { name: 'general' as const, categories: GENERAL_CATEGORIES, list: GENERAL_QUESTIONS },
    ];
    for (const pack of packs) {
      for (const category of pack.categories) {
        const inSection = pack.list.filter((question) => question.category === category);
        for (const type of TYPES) {
          const count = inSection.filter((question) => question.type === type).length;
          expect(count, `${pack.name}/${category}/${type}`).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('las tandas seccionales etiquetan el hecho, no el hueco de ronda', () => {
    const mix = TRIVIAL_QUESTIONS.filter((question) => question.id.includes('-secmix-'));
    expect(mix.length).toBeGreaterThan(0);
    for (const question of mix) {
      expect(question.stem, question.id).toMatch(/^term:/);
      expect(question.stem, question.id).not.toMatch(/secmix/);
    }
  });

  it('un mismo hecho no se pregunta en dos modos distintos', () => {
    const seen = new Map<string, string>();
    for (const question of TRIVIAL_QUESTIONS) {
      const stem = inferStem(question);
      if (!stem) continue;
      const previous = seen.get(stem);
      expect(previous, `mismo hecho «${stem}»: ${question.id} y ${previous}`).toBeUndefined();
      seen.set(stem, question.id);
    }
  });

  it('cada pack tiene margen en los seis tipos', () => {
    const min: Record<QuestionType, number> = {
      choice: 80,
      truefalse: 30,
      numeric: 20,
      open: 30,
      odd: 15,
      order: 10,
    };
    for (const pack of ['dev', 'general'] as const) {
      const list = questionsOfPack(pack);
      for (const type of TYPES) {
        const count = list.filter((question) => question.type === type).length;
        expect(count, `${pack}/${type}`).toBeGreaterThanOrEqual(min[type]);
      }
    }
  });

  it('cada pregunta del pack dev usa una categoría conocida y el pack correcto', () => {
    const allowed = new Set<string>(DEV_CATEGORIES);
    for (const question of DEV_QUESTIONS) {
      expect(question.pack).toBe('dev');
      expect(allowed.has(question.category), question.id).toBe(true);
    }
  });

  it('cada pregunta de cultura usa una categoría conocida y el pack correcto', () => {
    const allowed = new Set<string>(GENERAL_CATEGORIES);
    for (const question of GENERAL_QUESTIONS) {
      expect(question.pack).toBe('general');
      expect(allowed.has(question.category), question.id).toBe(true);
    }
  });

  it('las de test y de «el que no encaja» tienen 4 opciones y la respuesta está entre ellas', () => {
    for (const question of TRIVIAL_QUESTIONS) {
      if (question.type !== 'choice' && question.type !== 'odd') continue;
      expect(question.options, question.id).toHaveLength(4);
      expect(question.options).toContain(question.answer);
    }
  });

  it('las de verdadero/falso solo admiten esas dos palabras', () => {
    for (const question of questionsOfType('truefalse')) {
      expect(question.options).toEqual(['Verdadero', 'Falso']);
      expect(['Verdadero', 'Falso']).toContain(question.answer);
    }
  });

  it('las numéricas responden con un número', () => {
    for (const question of questionsOfType('numeric')) {
      expect(typeof question.answer, question.id).toBe('number');
    }
  });

  it('las de ordenar tienen las mismas piezas en opciones y en la respuesta', () => {
    for (const question of questionsOfType('order')) {
      const options = [...(question.options ?? [])].sort();
      const answer = [...(question.answer as string[])].sort();
      expect(answer, question.id).toEqual(options);
      expect(options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('las abiertas tienen texto de respuesta', () => {
    for (const question of questionsOfType('open')) {
      expect(typeof question.answer, question.id).toBe('string');
      expect(String(question.answer).length).toBeGreaterThan(1);
    }
  });
});
