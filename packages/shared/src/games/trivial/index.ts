import { OPCIONES, TrivialAction } from './tipos';
import { repartoDe, respuestaDe } from './reglas';
import type {
  NivelBot,
  Pregunta,
  ResultadoDeRonda,
  Ronda,
  TrivialState,
  TrivialView,
} from './tipos';
import type { GameModule, RuleError, SeatId } from '../module';

const NIVELES: readonly NivelBot[] = ['pardillo', 'apanado', 'sabelotodo'];

const TERMINADA: RuleError = {
  code: 'partida-terminada',
  message: 'El concurso ya ha acabado.',
};

export const trivialModule: GameModule<TrivialState, TrivialAction> = {
  id: 'trivial',
  actionSchema: TrivialAction,

  /**
   * Las preguntas llegan por la configuración de la sala, no de un banco que
   * este paquete importe.
   *
   * Es la línea que mantiene las respuestas fuera del navegador: el banco vive
   * en el servidor, y aquí solo entra lo que el servidor ha decidido repartir.
   */
  createState(_seats, config) {
    return {
      rondas: preguntasDe(config).map(primeraRonda),
      actual: 0,
      puntos: {},
      fase: 'presentacion',
      orden: [],
      jugadas: 0,
      semilla: typeof config['semilla'] === 'number' ? config['semilla'] : 1,
      nivelBot: esNivel(config['nivelBot']) ? config['nivelBot'] : 'apanado',
    };
  },

  validate(state, action, by) {
    switch (action.tipo) {
      case 'empezar':
        if (state.fase !== 'presentacion') {
          return { code: 'ya-empezado', message: 'El concurso ya está en marcha.' };
        }
        if (state.rondas.length === 0) {
          return { code: 'sin-preguntas', message: 'Esta sala se quedó sin preguntas.' };
        }
        return by in indice(state.orden)
          ? { code: 'ya-listo', message: 'Ya estabas listo.' }
          : null;

      case 'responder': {
        if (state.fase === 'fin') return TERMINADA;
        const ronda = rondaActual(state);
        if (!ronda || state.fase === 'presentacion') {
          return { code: 'aun-no-hay-pregunta', message: 'Todavía no hay pregunta.' };
        }
        if (ronda.cerrada) return { code: 'ronda-cerrada', message: 'Esa ronda ya se cerró.' };
        if (!state.orden.includes(by)) {
          return { code: 'no-juegas', message: 'No estás jugando este concurso.' };
        }
        if (respuestaDe(ronda.respuestas, by)) {
          return { code: 'ya-respondida', message: 'Ya has contestado.' };
        }
        return valorPosible(ronda.pregunta, action.valor);
      }

      case 'siguiente': {
        if (state.fase === 'fin') return TERMINADA;
        if (state.fase === 'presentacion') {
          return { code: 'aun-no-hay-pregunta', message: 'El concurso no ha empezado.' };
        }
        const ronda = rondaActual(state);
        // Forzar el paso cuando la ronda sigue viva es cosa de quien abrió la
        // sala: si no, cualquiera corta la pregunta a los demás.
        if (ronda && !ronda.cerrada && state.orden[0] !== by) {
          return { code: 'ronda-en-marcha', message: 'La ronda sigue abierta.' };
        }
        return null;
      }
    }
  },

  apply(state, action, by, seats) {
    const jugadas = state.jugadas + 1;

    switch (action.tipo) {
      case 'empezar': {
        const orden = [...state.orden, by];
        // El concurso arranca cuando están todos los que hay en la sala: con la
        // mesa a medias, quien llega tarde se encontraría la primera pregunta ya
        // contestada.
        const todos = orden.length >= seats.filter((seat) => !seat.isBot).length;
        return { ...state, jugadas, orden, fase: todos ? 'ronda' : 'presentacion' };
      }

      case 'responder': {
        const ronda = rondaActual(state);
        if (!ronda) return { ...state, jugadas };

        const conRespuesta: Ronda = {
          ...ronda,
          respuestas: {
            ...ronda.respuestas,
            [by]: { valor: action.valor, orden: Object.keys(ronda.respuestas).length },
          },
        };

        const faltan = state.orden.filter((seat) => !(seat in conRespuesta.respuestas));
        return faltan.length === 0
          ? { ...cerrar(state, conRespuesta), jugadas }
          : { ...conRondaActual(state, conRespuesta), jugadas };
      }

      case 'siguiente': {
        const ronda = rondaActual(state);
        const cerrada = ronda && !ronda.cerrada ? cerrar(state, ronda) : state;
        const siguiente = cerrada.actual + 1;

        return siguiente >= cerrada.rondas.length
          ? { ...cerrada, jugadas, fase: 'fin' }
          : { ...cerrada, jugadas, actual: siguiente, fase: 'ronda' };
      }
    }
  },

  /**
   * Mientras la ronda está abierta, la respuesta correcta no sale de aquí.
   *
   * Ni la explicación, que la delata, ni lo que han puesto los demás. En un
   * concurso entre programadores, mandar la respuesta al navegador y confiar en
   * que nadie mire es no tener concurso.
   */
  view(state, forSeat) {
    const ronda = rondaActual(state);
    const cerrada = ronda?.cerrada ?? false;
    const pregunta = ronda?.pregunta;
    const propia = ronda ? respuestaDe(ronda.respuestas, forSeat) : undefined;

    return {
      fase: state.fase,
      ronda: state.actual + 1,
      rondas: state.rondas.length,
      tipo: pregunta && state.fase !== 'presentacion' ? pregunta.tipo : null,
      enunciado: pregunta && state.fase !== 'presentacion' ? pregunta.enunciado : '',
      codigo: (state.fase !== 'presentacion' ? pregunta?.codigo : undefined) ?? null,
      opciones: state.fase !== 'presentacion' ? (pregunta?.opciones ?? []) : [],
      cerrada,
      hanRespondido: ronda ? Object.keys(ronda.respuestas) : [],
      tuRespuesta: propia?.valor ?? null,
      puntos: state.puntos,
      correcta: cerrada && pregunta ? pregunta.correcta : null,
      explicacion: cerrada && pregunta ? pregunta.explicacion : null,
      resultados: cerrada && ronda ? resultadosDe(ronda) : null,
    } satisfies TrivialView;
  },

  /** Irse no borra lo ganado: el marcador es de la partida, no de la conexión. */
  onSeatLeave(state) {
    return state;
  },
};

function primeraRonda(pregunta: Pregunta): Ronda {
  return { pregunta, cerrada: false, respuestas: {} };
}

function rondaActual(state: TrivialState): Ronda | undefined {
  return state.rondas[state.actual];
}

function conRondaActual(state: TrivialState, ronda: Ronda): TrivialState {
  return {
    ...state,
    rondas: state.rondas.map((otra, i) => (i === state.actual ? ronda : otra)),
  };
}

/**
 * Cierra la ronda y reparte lo ganado.
 *
 * El reparto se hace una sola vez, aquí, y no al pintar: si se calculara en la
 * vista, el marcador cambiaría según quién mira.
 */
function cerrar(state: TrivialState, ronda: Ronda): TrivialState {
  const ganados = repartoDe(ronda.pregunta, ronda.respuestas);
  const puntos = { ...state.puntos };
  for (const [seat, suma] of Object.entries(ganados)) {
    puntos[seat] = (puntos[seat] ?? 0) + suma;
  }

  return {
    ...conRondaActual(state, { ...ronda, cerrada: true }),
    puntos,
    fase: 'resultado',
  };
}

function resultadosDe(ronda: Ronda): ResultadoDeRonda[] {
  const ganados = repartoDe(ronda.pregunta, ronda.respuestas);
  return Object.entries(ronda.respuestas).map(([seatId, respuesta]) => ({
    seatId,
    valor: respuesta.valor,
    ganados: ganados[seatId] ?? 0,
  }));
}

/**
 * Si ese valor tiene sentido para esta prueba.
 *
 * En las de opciones, el número es un índice y fuera de rango no significa
 * nada. En una estimación es la respuesta misma, y ahí cualquier número vale:
 * decir una barbaridad es una respuesta legítima, solo que mala.
 */
function valorPosible(pregunta: Pregunta, valor: number): RuleError | null {
  if (pregunta.tipo === 'estimacion') return null;
  return valor >= 0 && valor < OPCIONES
    ? null
    : { code: 'opcion-inexistente', message: 'Esa opción no existe.' };
}

function indice(orden: readonly SeatId[]): Record<SeatId, true> {
  return Object.fromEntries(orden.map((seat) => [seat, true]));
}

function preguntasDe(config: Readonly<Record<string, unknown>>): Pregunta[] {
  const puestas = config['preguntas'];
  return Array.isArray(puestas) ? (puestas as Pregunta[]) : [];
}

function esNivel(valor: unknown): valor is NivelBot {
  return typeof valor === 'string' && (NIVELES as readonly string[]).includes(valor);
}
