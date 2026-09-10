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

    /** Sin esto, «la clave está puesta y no habla» no se puede diagnosticar. */
    it('cuando el modelo falla, se avisa a quien mantiene el servidor', async () => {
      const { actor } = actorFalso();
      const { antes, ahora } = empezada();
      const modelo = vi.fn().mockRejectedValue(new Error('401 clave inválida'));
      const avisos: string[] = [];

      new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo, undefined, (motivo) => {
        avisos.push(motivo);
      }).trasJugada(actor, antes, ahora);

      await vi.waitFor(() => {
        expect(avisos).toHaveLength(1);
      });
      expect(avisos[0]).toContain('401');
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

    /**
     * Los datos los pone la partida; el modelo solo pone el tono.
     *
     * Al modelo se le manda el encargo del momento con el marcador entero
     * dentro. Antes se le mandaba solo «reescribe esta frase», y así no podía
     * presentar a nadie ni repasar una clasificación: no la tenía.
     */
    it('al modelo se le manda el encargo del momento con la mesa dentro', () => {
      const { actor } = actorFalso();
      const { antes, ahora } = empezada();
      const modelo = vi.fn().mockResolvedValue({ text: 'Hola.', model: 'x' });

      new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo).trasJugada(actor, antes, ahora);

      const mensajes = modelo.mock.calls[0][1] as { role: string; content: string }[];
      expect(mensajes[0].role).toBe('system');
      // El personaje va en el sistema; el encargo y los datos, en el usuario.
      expect(mensajes[0].content).toContain('Óscar');
      expect(mensajes[1].content).toContain('DATOS REALES');
      expect(mensajes[1].content).toContain('Ana');
      expect(mensajes[1].content).toContain('Bea');
    });

    /** Sin saber quién es máquina, no puede meterse con el bot. */
    it('y se le dice quién de la mesa es un bot', () => {
      const { actor } = actorFalso();
      const { antes, ahora } = empezada();
      const modelo = vi.fn().mockResolvedValue({ text: 'Hola.', model: 'x' });

      new PresentadorDeSala(
        CON_CLAVE,
        NOMBRES,
        modelo,
        () => new Set(['bea']),
      ).trasJugada(actor, antes, ahora);

      const mensajes = modelo.mock.calls[0][1] as { role: string; content: string }[];
      expect(mensajes[1].content).toContain('Bea: 0 puntos (es un bot)');
    });

    it('el encargo cambia con el momento, no es siempre el mismo', () => {
      const modelo = vi.fn().mockResolvedValue({ text: 'Hola.', model: 'x' });
      const presentador = new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo);

      const { antes, ahora } = empezada();
      presentador.trasJugada(actorFalso().actor, antes, ahora);

      let acabada = ahora;
      acabada = trivialModule.apply(acabada, { tipo: 'responder', valor: 1 }, 'ana', SEATS);
      acabada = trivialModule.apply(acabada, { tipo: 'responder', valor: 1 }, 'bea', SEATS);
      presentador.trasJugada(actorFalso().actor, ahora, acabada);

      const encargos = modelo.mock.calls.map(
        (llamada) => (llamada[1] as { content: string }[])[1].content,
      );
      expect(encargos[0]).not.toBe(encargos[1]);
    });
  });
});

describe('la clave del presentador', () => {
  it('sin clave no se llama a nadie', () => {
    expect(ajustesDeIa({ AI_KEY: '', AI_PROVIDER: 'openrouter', AI_MODEL: 'x' })).toBeNull();
  });

  it('con clave se monta el ajuste', () => {
    const ajustes = ajustesDeIa({ AI_KEY: 'k', AI_PROVIDER: 'groq', AI_MODEL: 'm' });
    expect(ajustes).toEqual({
      enabled: true,
      provider: 'groq',
      apiKey: 'k',
      model: 'm',
      freeOnly: true,
    });
  });

  /**
   * Con `freeOnly` encendido, un modelo de pago se descarta sin decir nada y
   * el juego se queda con el guion: es el fallo más difícil de diagnosticar
   * que tiene esto, porque desde fuera parece que la clave no sirve.
   */
  it('se puede permitir un modelo de pago, y hay que pedirlo a propósito', () => {
    const gratis = ajustesDeIa({ AI_KEY: 'k', AI_PROVIDER: 'openrouter', AI_MODEL: 'm' });
    expect(gratis?.freeOnly).toBe(true);

    const pagando = ajustesDeIa({
      AI_KEY: 'k',
      AI_PROVIDER: 'openrouter',
      AI_MODEL: 'm',
      AI_FREE_ONLY: false,
    });
    expect(pagando?.freeOnly).toBe(false);
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
