import { describe, expect, it, vi } from 'vitest';
import {
  describeBoard,
  localPlan,
  requestAdvice,
  requestTurnPlan,
  sanitizePlan,
} from './ai-orchestrator';
import { AiSettings, DEFAULT_AI_SETTINGS } from './ai-client';
import { TINY_MAP, forceTurn, makeGame, setBoard } from '../testing';
import { GameState } from '../types';

function board(): GameState {
  return forceTurn(
    setBoard(makeGame(), {
      A1: ['p1', 6],
      A2: ['p1', 3],
      A3: ['p1', 1],
      B1: ['p2', 2],
      B2: ['p2', 5],
      B3: ['p2', 1],
    }),
    'p2',
    'attack',
  );
}

function enabled(overrides: Partial<AiSettings> = {}): AiSettings {
  return { ...DEFAULT_AI_SETTINGS, enabled: true, apiKey: 'k', ...overrides };
}

function reply(content: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    text: async () => '',
  } as Response;
}

describe('orquestador de la IA', () => {
  describe('describeBoard', () => {
    it('resume el tablero en pocas líneas', () => {
      const text = describeBoard(board(), TINY_MAP, 'p2');
      expect(text).toContain('Mapa: Mapa de laboratorio');
      expect(text).toContain('Clasificación');
      expect(text).toContain('Continentes');
      expect(text.split('\n').length).toBeLessThanOrEqual(8);
    });

    it('incluye los códigos de territorio para que el modelo pueda citarlos', () => {
      const text = describeBoard(board(), TINY_MAP, 'p2');
      expect(text).toMatch(/\[[AB][123]\]/);
    });

    it('devuelve cadena vacía para un jugador desconocido', () => {
      expect(describeBoard(board(), TINY_MAP, 'nadie')).toBe('');
    });
  });

  describe('sanitizePlan', () => {
    const state = board();

    it('acepta un plan bien formado', () => {
      const plan = sanitizePlan(
        { mensaje: 'Voy a por Alfa', prioridad: 'atacar', objetivos: ['A1'], defender: ['B2'] },
        TINY_MAP,
        state,
        'p2',
      );
      expect(plan).not.toBeNull();
      expect(plan!.priority).toBe('atacar');
      expect(plan!.bias.targets).toEqual(['A1']);
      expect(plan!.bias.defend).toEqual(['B2']);
      expect(plan!.bias.thresholdShift).toBeLessThan(0);
    });

    it('descarta territorios inventados', () => {
      const plan = sanitizePlan(
        { mensaje: 'x', objetivos: ['ZZ', 'A1'], defender: ['QQ'] },
        TINY_MAP,
        state,
        'p2',
      );
      expect(plan!.bias.targets).toEqual(['A1']);
      expect(plan!.bias.defend).toEqual([]);
    });

    it('descarta objetivos que en realidad son propios', () => {
      const plan = sanitizePlan({ mensaje: 'x', objetivos: ['B1'] }, TINY_MAP, state, 'p2');
      expect(plan!.bias.targets).toEqual([]);
    });

    it('descarta defensas que no son propias', () => {
      const plan = sanitizePlan({ mensaje: 'x', defender: ['A1'] }, TINY_MAP, state, 'p2');
      expect(plan!.bias.defend).toEqual([]);
    });

    it('limita las listas a tres elementos', () => {
      const plan = sanitizePlan(
        { mensaje: 'x', objetivos: ['A1', 'A2', 'A3', 'A1'] },
        TINY_MAP,
        state,
        'p2',
      );
      expect(plan!.bias.targets!.length).toBeLessThanOrEqual(3);
    });

    it('cae en "expandir" si la prioridad no es válida', () => {
      const plan = sanitizePlan({ mensaje: 'x', prioridad: 'bailar' }, TINY_MAP, state, 'p2');
      expect(plan!.priority).toBe('expandir');
    });

    it('rechaza planes sin mensaje', () => {
      expect(sanitizePlan({ prioridad: 'atacar' }, TINY_MAP, state, 'p2')).toBeNull();
      expect(sanitizePlan({ mensaje: '   ' }, TINY_MAP, state, 'p2')).toBeNull();
    });

    it('rechaza cualquier cosa que no sea un objeto', () => {
      expect(sanitizePlan(null, TINY_MAP, state, 'p2')).toBeNull();
      expect(sanitizePlan('hola', TINY_MAP, state, 'p2')).toBeNull();
      expect(sanitizePlan(42, TINY_MAP, state, 'p2')).toBeNull();
    });

    it('recorta mensajes larguísimos', () => {
      const plan = sanitizePlan({ mensaje: 'a'.repeat(2000) }, TINY_MAP, state, 'p2');
      expect(plan!.message.length).toBeLessThanOrEqual(400);
    });

    it('ignora listas que no son listas', () => {
      const plan = sanitizePlan({ mensaje: 'x', objetivos: 'A1' }, TINY_MAP, state, 'p2');
      expect(plan!.bias.targets).toEqual([]);
    });
  });

  describe('localPlan', () => {
    it('siempre produce mensaje y sesgo', () => {
      const plan = localPlan(board(), TINY_MAP, 'p2');
      expect(plan.source).toBe('local');
      expect(plan.message.length).toBeGreaterThan(10);
      expect(plan.bias.targets!.length).toBeGreaterThan(0);
    });

    it('marca prioridad de ataque cuando hay una buena tirada', () => {
      const state = forceTurn(
        setBoard(makeGame(), {
          A1: ['p2', 12],
          A2: ['p2', 2],
          A3: ['p2', 2],
          B1: ['p1', 1],
          B2: ['p1', 1],
          B3: ['p1', 1],
        }),
        'p2',
        'attack',
      );
      expect(localPlan(state, TINY_MAP, 'p2').priority).toBe('atacar');
    });

    it('marca prioridad de consolidar cuando no hay nada que hacer', () => {
      const state = forceTurn(
        setBoard(makeGame(), {
          A1: ['p2', 1],
          A2: ['p2', 1],
          A3: ['p2', 1],
          B1: ['p1', 20],
          B2: ['p1', 20],
          B3: ['p1', 20],
        }),
        'p2',
        'attack',
      );
      expect(localPlan(state, TINY_MAP, 'p2').priority).toBe('consolidar');
    });

    it('guarda el motivo del respaldo local', () => {
      expect(localPlan(board(), TINY_MAP, 'p2', 'sin clave').fallbackReason).toBe('sin clave');
    });
  });

  describe('requestTurnPlan', () => {
    it('usa el cerebro local si la IA está desactivada', async () => {
      const plan = await requestTurnPlan(board(), TINY_MAP, 'p2', DEFAULT_AI_SETTINGS);
      expect(plan.source).toBe('local');
      expect(plan.fallbackReason).toContain('desactivada');
    });

    it('usa el plan del modelo cuando responde bien', async () => {
      const fetchImpl = vi.fn(async () =>
        reply({ mensaje: 'Voy a por A1', prioridad: 'atacar', objetivos: ['A1'] }),
      );
      const plan = await requestTurnPlan(board(), TINY_MAP, 'p2', enabled(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(plan.source).toBe('llm');
      expect(plan.message).toBe('Voy a por A1');
      expect(plan.bias.targets).toEqual(['A1']);
    });

    it('cae al cerebro local si el modelo devuelve basura', async () => {
      const fetchImpl = vi.fn(async () => reply({ cosas: 1 }));
      const plan = await requestTurnPlan(board(), TINY_MAP, 'p2', enabled(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(plan.source).toBe('local');
      expect(plan.fallbackReason).toContain('no interpretable');
    });

    it('cae al cerebro local si la red falla', async () => {
      const fetchImpl = vi.fn(async () => {
        throw new Error('sin red');
      });
      const plan = await requestTurnPlan(board(), TINY_MAP, 'p2', enabled(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(plan.source).toBe('local');
      expect(plan.message.length).toBeGreaterThan(0);
    });

    it('nunca lanza: la partida no puede depender de una API', async () => {
      const fetchImpl = vi.fn(async () => {
        throw new Error('catástrofe');
      });
      await expect(
        requestTurnPlan(board(), TINY_MAP, 'p2', enabled(), {
          fetchImpl: fetchImpl as unknown as typeof fetch,
        }),
      ).resolves.toBeTruthy();
    });
  });

  describe('requestAdvice', () => {
    it('da consejo local sin IA configurada', async () => {
      const advice = await requestAdvice(board(), TINY_MAP, 'p1', DEFAULT_AI_SETTINGS);
      expect(advice.source).toBe('local');
      expect(advice.message.length).toBeGreaterThan(10);
    });

    it('usa el mensaje del modelo si lo hay', async () => {
      const fetchImpl = vi.fn(async () => reply({ mensaje: 'Refuerza el norte' }));
      const advice = await requestAdvice(board(), TINY_MAP, 'p1', enabled(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(advice.source).toBe('llm');
      expect(advice.message).toBe('Refuerza el norte');
    });

    it('cae al consejo local si el modelo no dice nada útil', async () => {
      const fetchImpl = vi.fn(async () => reply({ otra_cosa: true }));
      const advice = await requestAdvice(board(), TINY_MAP, 'p1', enabled(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(advice.source).toBe('local');
    });

    it('cae al consejo local si hay error de red', async () => {
      const fetchImpl = vi.fn(async () => {
        throw new Error('nope');
      });
      const advice = await requestAdvice(board(), TINY_MAP, 'p1', enabled(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(advice.source).toBe('local');
    });
  });
});
