import { describe, expect, it, vi } from 'vitest';
import { PresentadorDeSala, ajustesDeIa, nombresDe } from './presentador';
import { trivialModule } from '@devweb/shared/games/trivial/index';
import { presupuestoDe } from '@devweb/shared/games/trivial/medida';
import { largoDe } from '@devweb/shared/games/trivial/prompts';
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

  it('con clave se monta el ajuste, con la voz del presentador apagada', () => {
    // `enabled` dejó de significar «hay IA» y pasó a significar «el presentador
    // improvisa». Lo segundo viene apagado; la clave sigue ahí, que es lo que
    // el inventor de preguntas necesita.
    const ajustes = ajustesDeIa({ AI_KEY: 'k', AI_PROVIDER: 'groq', AI_MODEL: 'm' });
    expect(ajustes).toEqual({
      enabled: false,
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

/**
 * La medida de cada momento, que es lo que devolvió la voz al presentador.
 *
 * En producción llevaba mudo desde el 10 de septiembre: el modelo contestaba
 * bien y nosotros tirábamos entero todo lo que decía por pasarse de largo.
 * Diez de diez, ninguna respuesta por debajo de 375 letras contra un tope de
 * 320 y un presupuesto de 120 tokens que da para 480.
 */
describe('lo que el presentador se atreve a decir', () => {
  it('recorta la respuesta larga en vez de tirarla', async () => {
    const { actor, dicho } = actorFalso();
    const { antes, ahora } = empezada();
    const ladrillo = 'Menudo nivel, señores. '.repeat(30);
    const modelo = vi.fn().mockResolvedValue({ text: ladrillo, model: 'x' });

    new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo).trasJugada(actor, antes, ahora);
    await vi.waitFor(() => {
      expect(dicho).toHaveLength(2);
    });

    const florida = dicho[1].accion.frase;
    expect(florida.length).toBeLessThanOrEqual(largoDe('bienvenida'));
    // Por frases enteras: media frase del presentador suena a fallo.
    expect(florida.endsWith('.')).toBe(true);
  });

  it('se queda con el guion cuando no hay ni una frase aprovechable', async () => {
    const { actor, dicho } = actorFalso();
    const { antes, ahora } = empezada();
    const modelo = vi.fn().mockResolvedValue({ text: 'palabra '.repeat(100), model: 'x' });

    new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo).trasJugada(actor, antes, ahora);
    await Promise.resolve();
    await Promise.resolve();

    expect(dicho).toHaveLength(1);
  });

  it('le pide al modelo los tokens que pide la medida del momento', async () => {
    const { actor } = actorFalso();
    const { antes, ahora } = empezada();
    const modelo = vi.fn().mockResolvedValue({ text: 'Buenas noches.', model: 'x' });

    new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo).trasJugada(actor, antes, ahora);

    const opciones = modelo.mock.calls[0][2] as { maxTokens?: number };
    expect(opciones.maxTokens).toBe(presupuestoDe(largoDe('bienvenida')));
  });

  it('le da su turno a cada modelo, no la paciencia entera al primero', async () => {
    const { actor } = actorFalso();
    const { antes, ahora } = empezada();
    const modelo = vi.fn().mockResolvedValue({ text: 'Buenas noches.', model: 'x' });

    new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo).trasJugada(actor, antes, ahora);

    // Sin esto, el primer modelo lento se come la paciencia entera y los cuatro
    // de reserva no llegan a estrenarse. Le pasaba al crupier y allí se arregló.
    const ajustes = modelo.mock.calls[0][0] as AiSettings;
    expect(ajustes.timeoutMs).toBeDefined();
    expect(ajustes.timeoutMs).toBeLessThan(25_000);
  });
});

/**
 * El presentador habla de guion salvo que se le encienda la IA.
 *
 * La cuota gratuita es de la cuenta y del día, y un programa entero son veinte
 * momentos: gastarla en frases de relleno la deja sin nada para lo único que
 * una máquina hace mejor que un guion escrito, que es inventarse las
 * preguntas. Por eso viene apagado.
 */
describe('el interruptor del presentador', () => {
  it('viene apagado: con clave y sin encenderlo, no llama a nadie', () => {
    const { actor, dicho } = actorFalso();
    const { antes, ahora } = empezada();
    const modelo = vi.fn().mockResolvedValue({ text: 'Buenas noches.', model: 'x' });

    new PresentadorDeSala(sinEncender(CON_CLAVE), NOMBRES, modelo).trasJugada(actor, antes, ahora);

    expect(modelo).not.toHaveBeenCalled();
    // Y aun así habla: el guion escrito es el presentador, no un plan B.
    expect(dicho).toHaveLength(1);
    expect(dicho[0].accion.frase.length).toBeGreaterThan(10);
  });

  it('encendido, vuelve a florear', async () => {
    const { actor, dicho } = actorFalso();
    const { antes, ahora } = empezada();
    const modelo = vi.fn().mockResolvedValue({ text: 'Buenas noches, criaturas.', model: 'x' });

    new PresentadorDeSala(CON_CLAVE, NOMBRES, modelo).trasJugada(actor, antes, ahora);

    await vi.waitFor(() => {
      expect(dicho).toHaveLength(2);
    });
  });

  it('la configuración lo deja apagado mientras no se pida', () => {
    const base = { AI_KEY: 'k', AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-20b' };

    expect(ajustesDeIa(base)?.enabled).toBe(false);
    expect(ajustesDeIa({ ...base, AI_PRESENTADOR: true })?.enabled).toBe(true);
  });

  it('pero las preguntas se inventan igual, que es en lo que sí se gasta', () => {
    // `enabled` es solo la voz del presentador. La clave sigue ahí para que el
    // inventor de preguntas la use.
    const ajustes = ajustesDeIa({ AI_KEY: 'k', AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-20b' });

    expect(ajustes).not.toBeNull();
    expect(ajustes?.apiKey).toBe('k');
  });
});

/** Los mismos ajustes, pero con la voz del presentador apagada. */
function sinEncender(ajustes: AiSettings): AiSettings {
  return { ...ajustes, enabled: false };
}

describe('un programa entero sin repetirse', () => {
  it('el mismo momento, cuatro veces seguidas, dice cuatro cosas distintas', () => {
    // Lo que delata a un guion escrito no es que sea escrito: es oírle la misma
    // frase dos veces en el mismo programa.
    const { actor, dicho } = actorFalso();
    const presentador = new PresentadorDeSala(null, NOMBRES);

    let antes = trivialModule.createState(SEATS, { preguntas: PREGUNTAS, semilla: 11 });
    let ahora = trivialModule.apply(antes, { tipo: 'empezar' }, 'ana', SEATS);
    ahora = trivialModule.apply(ahora, { tipo: 'empezar' }, 'bea', SEATS);

    // Cuatro bienvenidas seguidas, contando cada una como el programa la cuenta.
    for (let vez = 0; vez < 4; vez += 1) {
      presentador.trasJugada(actor, antes, ahora);
      const ultima = dicho.at(-1);
      if (ultima) {
        ahora = trivialModule.apply(
          ahora,
          { tipo: 'presenta', momento: ultima.accion.momento, frase: ultima.accion.frase },
          'ana',
          SEATS,
        );
      }
      antes = trivialModule.createState(SEATS, { preguntas: PREGUNTAS, semilla: 11 });
    }

    const frases = dicho.map((una) => una.accion.frase);
    expect(frases).toHaveLength(4);
    expect(new Set(frases).size).toBe(4);
  });

  it('y nombra al segundo y al último cuando hay mesa para ello', () => {
    const cuatro: Seat[] = [
      ...SEATS,
      { id: 'caco', displayName: 'Caco', isBot: false, connected: true, order: 2 },
      { id: 'dana', displayName: 'Dana', isBot: false, connected: true, order: 3 },
    ];
    const nombres = () => ({ ana: 'Ana', bea: 'Bea', caco: 'Caco', dana: 'Dana' });
    const { actor, dicho } = actorFalso();

    let antes = trivialModule.createState(cuatro, { preguntas: PREGUNTAS, semilla: 3 });
    let ahora = antes;
    for (const quien of ['ana', 'bea', 'caco', 'dana']) {
      ahora = trivialModule.apply(ahora, { tipo: 'empezar' }, quien, cuatro);
    }

    // Se recorren unas cuantas veces para cazar alguna de las frases que sí
    // nombran al resto de la mesa: no todas lo hacen.
    const salen = new Set<string>();
    for (let vez = 0; vez < 12; vez += 1) {
      new PresentadorDeSala(null, nombres).trasJugada(actor, antes, ahora);
      const ultima = dicho.at(-1);
      if (!ultima) continue;
      salen.add(ultima.accion.frase);
      ahora = trivialModule.apply(
        ahora,
        { tipo: 'presenta', momento: ultima.accion.momento, frase: ultima.accion.frase },
        'ana',
        cuatro,
      );
      antes = trivialModule.createState(cuatro, { preguntas: PREGUNTAS, semilla: 3 });
    }

    expect(salen.size).toBeGreaterThan(4);
    for (const frase of salen) expect(frase).not.toContain('{');
  });
});
