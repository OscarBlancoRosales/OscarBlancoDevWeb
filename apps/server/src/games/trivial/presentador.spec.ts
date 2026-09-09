import { describe, expect, it, vi } from 'vitest';
import { PresentadorDeSala, ajustesDeIa, nombresDe } from './presentador';
import { trivialModule } from '@devweb/shared/games/trivial/index';
import type { AiSettings } from '@devweb/shared/engine/ai/ai-client';
import type { Pregunta, TrivialState } from '@devweb/shared/games/trivial/tipos';
import type { RoomActor } from '../../rooms/actor';
import type { Seat } from '@devweb/shared/games/module';

/**
 * El presentador hablando desde el servidor.
 *
 * Es lo que convierte el concurso en un programa: antes hablaba en el navegador
 * de cada jugador, con la clave de cada uno, así que la mesa oía cinco frases
 * distintas y quien no tenía clave no oía nada.
 */

const SEATS: Seat[] = [
  { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 },
  { id: 'bea', displayName: 'Bea', isBot: false, connected: true, order: 1 },
];

const NOMBRES = () => ({ ana: 'Ana', bea: 'Bea' });

const PREGUNTAS: Pregunta[] = [
  {
    id: 'p1',
    tipo: 'test',
    enunciado: '¿Sí o no?',
    opciones: ['no', 'sí', 'quizá', 'nunca'],
    correcta: 1,
    explicacion: 'Pues eso.',
  },
  {
    id: 'p2',
    tipo: 'test',
    enunciado: '¿Y ahora?',
    opciones: ['no', 'sí', 'quizá', 'nunca'],
    correcta: 1,
    explicacion: 'Igual.',
  },
];

/** Un actor de mentira que apunta lo que le mandan decir. */
function actorFalso() {
  const dicho: { seatId: string; accion: { tipo: string; momento: string; frase: string } }[] = [];
  const actor = {
    aplicarDelSistema(seatId: string, accion: unknown) {
      const dicha = accion as { tipo: string; momento: string; frase: string };
      dicho.push({ seatId, accion: dicha });
    },
  };
  return { actor: actor as unknown as RoomActor, dicho };
}

function empezada(): { antes: TrivialState; ahora: TrivialState } {
  const antes = trivialModule.createState(SEATS, { preguntas: PREGUNTAS, semilla: 5 });
  let ahora = trivialModule.apply(antes, { tipo: 'empezar' }, 'ana', SEATS);
  ahora = trivialModule.apply(ahora, { tipo: 'empezar' }, 'bea', SEATS);
  return { antes, ahora };
}

const CON_CLAVE: AiSettings = {
  enabled: true,
  provider: 'openrouter',
  apiKey: 'clave-de-mentira',
  model: 'un/modelo',
};

describe('el presentador de la sala', () => {
  it('habla cuando arranca el concurso', () => {
    const { actor, dicho } = actorFalso();
    const { antes, ahora } = empezada();

    new PresentadorDeSala(null, NOMBRES).trasJugada(actor, antes, ahora);

    expect(dicho).toHaveLength(1);
    expect(dicho[0].accion.momento).toBe('bienvenida');
    expect(dicho[0].accion.frase.length).toBeGreaterThan(10);
  });

  it('y se calla cuando no ha pasado nada', () => {
    const { actor, dicho } = actorFalso();
    const { ahora } = empezada();

    new PresentadorDeSala(null, NOMBRES).trasJugada(actor, ahora, ahora);
    expect(dicho).toEqual([]);
  });

  /** Sin esto, un modelo caído dejaría el programa mudo. */
  it('sin clave dice el guion escrito, no se queda callado', () => {
    const { actor, dicho } = actorFalso();
    const { antes, ahora } = empezada();

    new PresentadorDeSala(null, NOMBRES).trasJugada(actor, antes, ahora);
    expect(dicho[0].accion.frase).toContain('Óscar');
  });

  it('llama a la gente por su nombre, no por su identificador', () => {
    const { actor, dicho } = actorFalso();
    let state = empezada().ahora;
    const antes = state;
    state = trivialModule.apply(state, { tipo: 'responder', valor: 1 }, 'bea', SEATS);
    state = trivialModule.apply(state, { tipo: 'responder', valor: 0 }, 'ana', SEATS);

    new PresentadorDeSala(null, NOMBRES).trasJugada(actor, antes, state);
    expect(dicho[0].accion.frase).toContain('Bea');
    expect(dicho[0].accion.frase).not.toContain('bea');
  });

  describe('con un modelo detrás', () => {
    it('dice primero el guion y luego lo reescrito, para no dejar hueco', async () => {
      const { actor, dicho } = actorFalso();
      const { antes, ahora } = empezada();
      const modelo = vi.fn().mockResolvedValue({ text: 'Buenas noches, criaturas.', model: 'x' });

      new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo).trasJugada(actor, antes, ahora);
      expect(dicho).toHaveLength(1);

      await vi.waitFor(() => {
        expect(dicho).toHaveLength(2);
      });
      expect(dicho[1].accion.frase).toBe('Buenas noches, criaturas.');
      expect(dicho[1].accion.momento).toBe('bienvenida');
    });

    it('si el modelo falla se queda lo escrito y nadie se entera', async () => {
      const { actor, dicho } = actorFalso();
      const { antes, ahora } = empezada();
      const modelo = vi.fn().mockRejectedValue(new Error('sin cuota'));

      new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo).trasJugada(actor, antes, ahora);
      await Promise.resolve();
      await Promise.resolve();

      expect(dicho).toHaveLength(1);
      expect(dicho[0].accion.frase.length).toBeGreaterThan(10);
    });

    it('y si contesta un ladrillo, tampoco lo suelta', async () => {
      const { actor, dicho } = actorFalso();
      const { antes, ahora } = empezada();
      const modelo = vi.fn().mockResolvedValue({ text: 'a'.repeat(500), model: 'x' });

      new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo).trasJugada(actor, antes, ahora);
      await Promise.resolve();
      await Promise.resolve();

      expect(dicho).toHaveLength(1);
    });

    /** Los datos los pone la partida; el modelo solo pone el tono. */
    it('al modelo se le manda la frase ya hecha, no los datos crudos', () => {
      const { actor } = actorFalso();
      const { antes, ahora } = empezada();
      const modelo = vi.fn().mockResolvedValue({ text: 'Hola.', model: 'x' });

      new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo).trasJugada(actor, antes, ahora);

      const mensajes = modelo.mock.calls[0][1] as { role: string; content: string }[];
      expect(mensajes[0].role).toBe('system');
      expect(mensajes[1].content).toContain('Óscar');
    });
  });
});

describe('la clave del presentador', () => {
  it('sin clave no se llama a nadie', () => {
    expect(ajustesDeIa({ AI_KEY: '', AI_PROVIDER: 'openrouter', AI_MODEL: 'x' })).toBeNull();
  });

  it('con clave se monta el ajuste', () => {
    const ajustes = ajustesDeIa({ AI_KEY: 'k', AI_PROVIDER: 'groq', AI_MODEL: 'm' });
    expect(ajustes).toEqual({ enabled: true, provider: 'groq', apiKey: 'k', model: 'm' });
  });

  /** Un proveedor mal escrito no puede tumbar el arranque del servidor. */
  it('un proveedor que no existe cae en el de por defecto', () => {
    expect(ajustesDeIa({ AI_KEY: 'k', AI_PROVIDER: 'inventado', AI_MODEL: 'm' })?.provider).toBe(
      'openrouter',
    );
  });
});

describe('los nombres de la mesa', () => {
  it('salen de los asientos', () => {
    expect(
      nombresDe([
        { seatId: 'a', displayName: 'Ana' },
        { seatId: 'b', displayName: 'Bea' },
      ]),
    ).toEqual({ a: 'Ana', b: 'Bea' });
  });
});
