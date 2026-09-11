import { OPCIONES, TrivialAction, rondaEn } from './tipos';
import { aciertaCon, repartoDe, respuestaDe } from './reglas';
import { respuestaDelBot } from './bot';
import { rngFor } from '../../engine/rng';
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
  // La voz del presentador y el reloj los pone el servidor. Si los pudiera
  // mandar un cliente, cualquiera hablaría por boca del presentador al resto de
  // la mesa, o se daría a sí mismo todo el tiempo del mundo.
  accionesDeSistema: ['presenta', 'reloj', 'tiempo'],

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
      racha: {},
      turno: null,
      mecha: 0,
      cierraEn: 0,
      dice: '',
      momento: '',
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
        // Con la bomba contesta quien la tiene. Los demás miran, que de eso va.
        if (ronda.pregunta.tipo === 'bomba' && state.turno !== by) {
          return { code: 'no-es-tu-turno', message: 'La bomba no la tienes tú.' };
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

      // Las pone el servidor. No las valida nadie más porque nadie más las
      // manda: al cliente no se le ofrecen estas acciones.
      case 'presenta':
      case 'reloj':
      case 'tiempo':
        return null;
    }
  },

  apply(state, action, by, seats) {
    const jugadas = state.jugadas + 1;

    switch (action.tipo) {
      case 'empezar': {
        const orden = [...state.orden, by];
        // Arranca cuando están todos los asientos, bots incluidos: con la mesa a
        // medias, quien llega tarde se encontraría la primera pregunta ya
        // contestada. Contar solo a las personas hacía que un bot, que se sienta
        // solo y al instante, diera por empezado el concurso él sin nadie más.
        const todos = orden.length >= seats.length;
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

        return { ...cerrarSiProcede(state, conRespuesta, action.valor), jugadas };
      }

      case 'siguiente': {
        const ronda = rondaActual(state);
        const cerrada = ronda && !ronda.cerrada ? cerrar(state, ronda) : state;
        const siguiente = cerrada.actual + 1;

        if (siguiente >= cerrada.rondas.length) {
          return { ...cerrada, jugadas, fase: 'fin', turno: null };
        }
        return {
          ...conBomba(cerrada, siguiente),
          jugadas,
          actual: siguiente,
          fase: 'ronda',
          // El reloj de la ronda nueva lo pone el regidor con la hora de
          // verdad. Heredar el de la anterior la haría nacer vencida.
          cierraEn: 0,
        };
      }

      case 'presenta':
        return { ...state, jugadas, dice: action.frase, momento: action.momento };

      case 'reloj':
        return { ...state, jugadas, cierraEn: action.hasta };

      case 'tiempo': {
        const ronda = rondaActual(state);
        // Una ronda ya cerrada no se vuelve a cerrar. Devolver el mismo objeto
        // es lo que hace que esta jugada no se escriba en el registro: el
        // temporizador salta a menudo sobre rondas que la mesa acaba de cortar.
        if (!ronda || ronda.cerrada || state.fase !== 'ronda') return state;
        return { ...cerrar(state, conLaBombaPerdida(state, ronda)), jugadas };
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
      resultados: cerrada && ronda ? resultadosDe(state, ronda) : null,
      turno: state.turno,
      mecha: state.mecha,
      cierraEn: state.cierraEn,
      tuTurno: pregunta?.tipo === 'bomba' ? state.turno === forSeat : !cerrada,
      racha: state.racha[forSeat] ?? 0,
      dice: state.dice,
      momento: state.momento,
    } satisfies TrivialView;
  },

  /**
   * Lo que hace un asiento sin nadie detrás.
   *
   * Se sienta cuando empieza el concurso y contesta cuando hay pregunta. No
   * pasa nunca de ronda: cerrar la ronda a los demás es cosa de quien abrió la
   * sala, y un bot no tiene por qué meter prisa a nadie.
   */
  botAction(state, seat) {
    const rng = rngFor(state.semilla, state.jugadas, `trivial:${seat}`);

    if (state.fase === 'presentacion') {
      return state.orden.includes(seat) ? null : { tipo: 'empezar' };
    }
    if (state.fase !== 'ronda' || !state.orden.includes(seat)) return null;

    const ronda = rondaActual(state);
    if (!ronda || ronda.cerrada || respuestaDe(ronda.respuestas, seat)) return null;
    // Un bot tampoco puede quitarle la bomba a nadie.
    if (ronda.pregunta.tipo === 'bomba' && state.turno !== seat) return null;
    return { tipo: 'responder', valor: respuestaDelBot(ronda.pregunta, state.nivelBot, rng) };
  },

  /** Irse no borra lo ganado: el marcador es de la partida, no de la conexión. */
  onSeatLeave(state) {
    return state;
  },
};

/** El valor que se apunta por quien no llegó a contestar. Nunca acierta. */
const NO_CONTESTO = -1;

/**
 * La bomba de quien no contestó a tiempo, ya estallada.
 *
 * Fuera de la bomba, dejar de contestar solo cuesta los puntos que no se ganan.
 * Con la bomba en la mano es distinto: si no contestar saliera gratis, la
 * jugada ganadora sería quedarse quieto y ahorrarse el castigo, que es
 * exactamente lo que la prueba cobra por fallar.
 */
function conLaBombaPerdida(state: TrivialState, ronda: Ronda): Ronda {
  if (ronda.pregunta.tipo !== 'bomba' || !state.turno) return ronda;
  if (respuestaDe(ronda.respuestas, state.turno)) return ronda;

  return {
    ...ronda,
    respuestas: {
      ...ronda.respuestas,
      [state.turno]: { valor: NO_CONTESTO, orden: Object.keys(ronda.respuestas).length },
    },
  };
}

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
 * Si esa respuesta cierra la ronda, o si todavía falta gente.
 *
 * Cada prueba se cierra a su manera, y de eso vive el programa: la bomba se
 * cierra en cuanto contesta quien la tiene, «el primero que pulse» en cuanto
 * alguien acierta, y las de siempre cuando han contestado todos.
 */
function cerrarSiProcede(state: TrivialState, ronda: Ronda, valor: number): TrivialState {
  const tipo = ronda.pregunta.tipo;

  if (tipo === 'bomba') return cerrar(state, ronda);
  if (tipo === 'pulsa' && aciertaCon(ronda.pregunta, valor)) return cerrar(state, ronda);

  const faltan = state.orden.filter((seat) => !(seat in ronda.respuestas));
  return faltan.length === 0 ? cerrar(state, ronda) : conRondaActual(state, ronda);
}

/**
 * Cierra la ronda y reparte lo ganado.
 *
 * El reparto se hace una sola vez, aquí, y no al pintar: si se calculara en la
 * vista, el marcador cambiaría según quién mira.
 */
function cerrar(state: TrivialState, ronda: Ronda): TrivialState {
  const ganados = repartoDe(ronda.pregunta, ronda.respuestas, state.racha);
  const puntos = { ...state.puntos };
  for (const [seat, suma] of Object.entries(ganados)) {
    puntos[seat] = (puntos[seat] ?? 0) + suma;
  }

  return {
    ...conRondaActual(state, { ...ronda, cerrada: true }),
    puntos,
    racha: rachasTras(state, ronda),
    mecha: mechaTras(state, ronda),
    fase: 'resultado',
  };
}

/**
 * Cómo quedan las rachas de la ráfaga.
 *
 * Fuera de la ráfaga se ponen a cero todas: encadenar aciertos de secciones
 * distintas no es una racha, es haber jugado un rato.
 */
function rachasTras(state: TrivialState, ronda: Ronda): Record<SeatId, number> {
  if (ronda.pregunta.tipo !== 'rafaga') return {};

  const rachas: Record<SeatId, number> = { ...state.racha };
  for (const seat of state.orden) {
    const suya = respuestaDe(ronda.respuestas, seat);
    rachas[seat] =
      suya && aciertaCon(ronda.pregunta, suya.valor) ? (state.racha[seat] ?? 0) + 1 : 0;
  }
  return rachas;
}

/**
 * Lo que le queda a la mecha después de esta ronda.
 *
 * Solo baja con los aciertos: fallar hace estallar la bomba en el acto, así
 * que ahí lo que queda de mecha ya da igual.
 */
function mechaTras(state: TrivialState, ronda: Ronda): number {
  if (ronda.pregunta.tipo !== 'bomba') return 0;
  const suya = state.turno ? respuestaDe(ronda.respuestas, state.turno) : undefined;
  const acierta = suya ? aciertaCon(ronda.pregunta, suya.valor) : false;
  return acierta ? Math.max(0, state.mecha - 1) : 0;
}

/**
 * Prepara el turno de la bomba al entrar en una ronda.
 *
 * La mecha se enciende al empezar la sección y va cruzando rondas; dentro de
 * ella, la bomba pasa al siguiente. Si se agotó, se vuelve a encender: la
 * sección sigue hasta que se acaban sus preguntas.
 */
function conBomba(state: TrivialState, siguiente: number): TrivialState {
  const entra = rondaEn(state, siguiente)?.pregunta;
  if (entra?.tipo !== 'bomba') return { ...state, turno: null, mecha: 0 };

  const venia = rondaEn(state, state.actual)?.pregunta.tipo === 'bomba';
  const mecha = venia && state.mecha > 0 ? state.mecha : mechaInicial(state.orden.length);
  const turno = venia ? siguienteDe(state.orden, state.turno) : (state.orden[0] ?? null);

  return { ...state, turno, mecha };
}

/**
 * Cuánto aguanta la bomba antes de estallar.
 *
 * Más que jugadores, para que dé al menos una vuelta entera y nadie pueda
 * contar de quién será la última: si durase exactamente una vuelta, la mesa
 * sabría desde el principio a quién le toca comérsela.
 */
export function mechaInicial(jugadores: number): number {
  return Math.max(2, jugadores) + 2;
}

function siguienteDe(orden: readonly SeatId[], actual: SeatId | null): SeatId | null {
  if (orden.length === 0) return null;
  const donde = actual ? orden.indexOf(actual) : -1;
  return orden[(donde + 1) % orden.length] ?? null;
}

function resultadosDe(state: TrivialState, ronda: Ronda): ResultadoDeRonda[] {
  const ganados = repartoDe(ronda.pregunta, ronda.respuestas, state.racha);
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
  // Contra las opciones que tenga, no contra cuatro: la ráfaga es de dos.
  const cuantas = pregunta.opciones.length || OPCIONES;
  return valor >= 0 && valor < cuantas
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
