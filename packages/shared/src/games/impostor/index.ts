import { ImpostorAction, MINIMO_JUGADORES, MODOS, SEGUNDOS_DE_DEBATE, aQuienLeToca } from './tipos';
import { nombreDelTema } from './temas';
import {
  aciertaElDisparo,
  desenlaceDeLaVotacion,
  hanVotadoTodos,
  marcadorTras,
  masVotado,
  palabraPara,
} from './reglas';
import { disparoDelBot, pistaDelBot, votoDelBot } from './bot';
import { rngFor } from '../../engine/rng';
import type { Desenlace, Fase, ImpostorState, Modo, ImpostorView } from './tipos';
import type { GameModule, RuleError, Seat, SeatId } from '../module';

/**
 * El Impostor.
 *
 * Uno de la mesa no tiene la palabra. Se habla por turnos, una palabra cada
 * uno, y al final se vota. Todo lo que hace falta para jugarlo cabe en tres
 * funciones puras, y la única parte que no puede ser pura —el sorteo de la
 * palabra y del impostor— entra desde fuera como una acción del servidor.
 *
 * Eso último es lo que hace que el juego sea jugable: si el sorteo saliera de
 * la configuración de la sala, que es pública, cualquiera con la consola
 * abierta sabría desde el primer segundo quién es el impostor. Aquí el sorteo
 * viaja por el registro de acciones, que nunca sale del servidor.
 */

const SIN_EMPEZAR: RuleError = {
  code: 'sin-empezar',
  message: 'La ronda todavía no ha empezado.',
};

export const impostorModule: GameModule<ImpostorState, ImpostorAction> = {
  id: 'impostor',
  actionSchema: ImpostorAction,
  // El sorteo y la voz de la sala los pone el servidor. Si los pudiera mandar
  // un cliente, cualquiera se repartiría la palabra a sí mismo.
  accionesDeSistema: ['reparte', 'narra', 'debate', 'aVotar'],

  createState(_seats, config) {
    return {
      fase: 'sala',
      modo: esModo(config['modo']) ? config['modo'] : 'clasico',
      temaId: typeof config['tema'] === 'string' ? config['tema'] : 'mezcla',
      palabra: '',
      senuelo: '',
      orden: [],
      impostores: [],
      listos: [],
      vueltas: config['vueltas'] === 2 ? 2 : 1,
      segundosDebate: segundosDe(config['segundosDebate']),
      debateHasta: 0,
      vuelta: 0,
      turno: 0,
      pistas: [],
      votos: {},
      expulsado: null,
      opciones: [],
      intento: -1,
      desenlace: null,
      marcador: {},
      rondasJugadas: 0,
      impostoresPedidos: config['impostores'] === 2 ? 2 : 1,
      semilla: 0,
      jugadas: 0,
      dice: '',
      momento: '',
    };
  },

  validate(state, action, by, seats) {
    switch (action.tipo) {
      case 'listo':
        if (state.fase !== 'sala') return { code: 'ya-empezado', message: 'La ronda ya va.' };
        return state.listos.includes(by)
          ? { code: 'ya-listo', message: 'Ya estabas listo.' }
          : null;

      case 'pista': {
        if (state.fase !== 'pistas') return SIN_EMPEZAR;
        if (aQuienLeToca(state) !== by) {
          return { code: 'no-es-tu-turno', message: 'No te toca hablar.' };
        }
        return null;
      }

      case 'votar': {
        if (state.fase !== 'votacion') {
          return { code: 'aun-no-se-vota', message: 'Todavía no se vota.' };
        }
        if (!state.orden.includes(by)) {
          return { code: 'no-juegas', message: 'No estás jugando esta ronda.' };
        }
        if (by in state.votos) return { code: 'ya-votaste', message: 'Ya has votado.' };
        if (action.aQuien === by) {
          return { code: 'ni-de-broma', message: 'A ti mismo no te puedes votar.' };
        }
        return state.orden.includes(action.aQuien)
          ? null
          : { code: 'no-esta-en-la-mesa', message: 'Ese no juega esta ronda.' };
      }

      case 'adivinar': {
        if (state.fase !== 'ultima-palabra') {
          return { code: 'sin-disparo', message: 'No hay ninguna palabra que adivinar.' };
        }
        if (state.expulsado !== by) {
          return { code: 'no-es-tu-disparo', message: 'El disparo no es tuyo.' };
        }
        return action.opcion < state.opciones.length
          ? null
          : { code: 'opcion-inexistente', message: 'Esa palabra no está en la lista.' };
      }

      case 'alVoto': {
        if (state.fase !== 'debate') {
          return { code: 'no-hay-debate', message: 'Ahora mismo no se está debatiendo.' };
        }
        // Cortar la conversación es cosa de quien abrió la sala: si no,
        // cualquiera al que le esté yendo mal la deja a medias.
        return seats[0]?.id === by
          ? null
          : { code: 'no-eres-el-anfitrion', message: 'Solo el anfitrión corta el debate.' };
      }

      case 'otra': {
        if (state.fase !== 'fin') {
          return { code: 'ronda-en-marcha', message: 'La ronda no ha terminado.' };
        }
        if (seats.length < MINIMO_JUGADORES) {
          return { code: 'mesa-corta', message: 'Hacen falta al menos tres para otra ronda.' };
        }
        // Repartir otra vez es cosa de quien abrió la sala: si no, cualquiera
        // corta la conversación de después, que es media gracia del juego.
        return seats[0]?.id === by
          ? null
          : { code: 'no-eres-el-anfitrion', message: 'Solo el anfitrión reparte otra ronda.' };
      }

      // Las pone el servidor y no se le ofrecen al cliente, así que no hay
      // nada que juzgar: la puerta ya las filtró.
      case 'reparte':
      case 'narra':
      case 'debate':
      case 'aVotar':
        return null;
    }
  },

  apply(state, action, by, seats) {
    const jugadas = state.jugadas + 1;

    switch (action.tipo) {
      case 'listo': {
        const listos = [...state.listos, by];
        const llena = seats.length >= MINIMO_JUGADORES && listos.length >= seats.length;
        return { ...state, jugadas, listos, fase: llena ? 'repartiendo' : 'sala' };
      }

      case 'reparte':
        return {
          ...state,
          jugadas,
          fase: 'pistas',
          palabra: action.palabra,
          senuelo: action.senuelo,
          orden: action.orden,
          impostores: action.impostores,
          opciones: action.opciones,
          semilla: action.semilla,
          listos: action.orden,
          vuelta: 0,
          turno: 0,
          pistas: [],
          votos: {},
          expulsado: null,
          intento: -1,
          desenlace: null,
          debateHasta: 0,
        };

      case 'pista': {
        const pistas = [...state.pistas, { seatId: by, texto: action.texto, ronda: state.vuelta }];
        return { ...state, jugadas, pistas, ...trasHablar(state) };
      }

      case 'votar': {
        const votos = { ...state.votos, [by]: action.aQuien };
        const conVoto: ImpostorState = { ...state, jugadas, votos };
        return hanVotadoTodos(conVoto) ? cerrarVotacion(conVoto) : conVoto;
      }

      case 'adivinar': {
        const desenlace: Desenlace = aciertaElDisparo(state, action.opcion)
          ? 'impostores'
          : 'tripulacion';
        return {
          ...terminar(state, desenlace),
          jugadas,
          intento: action.opcion,
        };
      }

      // Estas dos pueden llegar tarde: el reloj del debate lo cierra un
      // temporizador, y para entonces la mesa puede haber cortado ya. Devolver
      // el mismo estado —y no una copia— es lo que le dice a la sala que aquí
      // no ha pasado nada y que no hay nada que escribir.
      case 'debate':
        return state.fase === 'debate' ? { ...state, jugadas, debateHasta: action.hasta } : state;

      case 'alVoto':
      case 'aVotar':
        return state.fase === 'debate'
          ? { ...state, jugadas, fase: 'votacion', debateHasta: 0 }
          : state;

      case 'otra':
        return { ...state, jugadas, fase: 'repartiendo' };

      case 'narra':
        return { ...state, jugadas, dice: action.frase, momento: action.momento };
    }
  },

  /**
   * Lo que ve cada uno, que es todo el juego.
   *
   * La palabra sale solo hacia quien tiene derecho a saberla, y quiénes son los
   * impostores no salen hacia nadie hasta que la ronda acaba. Ni siquiera hacia
   * el propio impostor en el modo infiltrado: ahí la gracia es que él tampoco
   * lo sabe.
   */
  view(state, forSeat) {
    const acabada = state.fase === 'fin';
    const eres = state.impostores.includes(forSeat);
    const votando = state.fase === 'votacion';

    return {
      fase: state.fase,
      modo: state.modo,
      tema: nombreDelTema(state.temaId),
      tuPalabra: state.palabra
        ? palabraPara(state.modo, eres, state.palabra, state.senuelo)
        : null,
      eresImpostor: eres && state.modo !== 'infiltrado' && state.fase !== 'sala',
      orden: state.orden,
      listos: state.listos,
      vuelta: state.vuelta + 1,
      vueltas: state.vueltas,
      debateHasta: state.debateHasta,
      segundosDebate: state.segundosDebate,
      turno: aQuienLeToca(state),
      tuTurno: aQuienLeToca(state) === forSeat,
      pistas: state.pistas,
      hanVotado: Object.keys(state.votos),
      tuVoto: state.votos[forSeat] ?? null,
      votos: votando ? null : state.votos,
      expulsado: state.expulsado,
      opciones: state.fase === 'ultima-palabra' || acabada ? state.opciones : [],
      intento: state.intento,
      tuDisparo: state.fase === 'ultima-palabra' && state.expulsado === forSeat,
      palabra: acabada ? state.palabra : null,
      impostores: acabada ? state.impostores : null,
      desenlace: state.desenlace,
      marcador: state.marcador,
      rondasJugadas: state.rondasJugadas,
      dice: state.dice,
      momento: state.momento,
    } satisfies ImpostorView;
  },

  botAction(state, seat) {
    const rng = rngFor(state.semilla, state.jugadas, `impostor:${seat}`);

    if (state.fase === 'sala') {
      return state.listos.includes(seat) ? null : { tipo: 'listo' };
    }
    if (!state.orden.includes(seat)) return null;

    if (state.fase === 'pistas' && aQuienLeToca(state) === seat) {
      return { tipo: 'pista', texto: pistaDelBot(state, seat, rng) };
    }
    if (state.fase === 'votacion' && !(seat in state.votos)) {
      const aQuien = votoDelBot(state, seat, rng);
      return aQuien === null ? null : { tipo: 'votar', aQuien };
    }
    if (state.fase === 'ultima-palabra' && state.expulsado === seat) {
      return { tipo: 'adivinar', opcion: disparoDelBot(state, rng) };
    }
    return null;
  },

  /**
   * Quien se va deja de jugar esta ronda.
   *
   * Aquí no vale con no hacer nada, como en el concurso: si el que se marcha
   * era a quien le tocaba hablar, la mesa entera se queda esperando un turno
   * que ya no va a llegar. Se le saca del orden y la ronda sigue con los que
   * quedan.
   */
  onSeatLeave(state, seat) {
    if (!state.orden.includes(seat)) {
      return { ...state, listos: state.listos.filter((uno) => uno !== seat) };
    }

    const orden = state.orden.filter((uno) => uno !== seat);
    const votos = Object.fromEntries(
      Object.entries(state.votos).filter(([quien]) => quien !== seat),
    );
    const sinEl: ImpostorState = {
      ...state,
      orden,
      votos,
      listos: state.listos.filter((uno) => uno !== seat),
      turno: Math.min(state.turno, Math.max(0, orden.length - 1)),
    };

    // Si el que se va era el impostor pillado, no queda disparo que esperar.
    if (state.fase === 'ultima-palabra' && state.expulsado === seat) {
      return terminar(sinEl, 'tripulacion');
    }
    if (orden.length < MINIMO_JUGADORES && state.fase !== 'sala' && state.fase !== 'fin') {
      return terminar(sinEl, null);
    }
    if (sinEl.fase === 'votacion' && hanVotadoTodos(sinEl)) return cerrarVotacion(sinEl);
    return sinEl;
  },
};

/** Dónde queda el turno después de que alguien hable. */
function trasHablar(state: ImpostorState): { turno: number; vuelta: number; fase: Fase } {
  const siguiente = state.turno + 1;
  if (siguiente < state.orden.length) {
    return { turno: siguiente, vuelta: state.vuelta, fase: 'pistas' };
  }

  const vuelta = state.vuelta + 1;
  if (vuelta < state.vueltas) return { turno: 0, vuelta, fase: 'pistas' };

  // Dichas todas las pistas se abre el debate, no la votación: votar sobre
  // cuatro palabras sueltas y sin hablarlo es echarlo a suertes.
  return { turno: 0, vuelta: state.vuelta, fase: 'debate' };
}

/**
 * Cuenta los votos y decide qué pasa.
 *
 * En la revancha, pillar al impostor no acaba la ronda: abre la última palabra.
 * Es el único sitio donde la votación no termina en un resultado.
 */
function cerrarVotacion(state: ImpostorState): ImpostorState {
  const expulsado = masVotado(state.votos);
  const desenlace = desenlaceDeLaVotacion(state, expulsado);
  const conExpulsado: ImpostorState = { ...state, expulsado };

  if (desenlace === null) {
    return { ...conExpulsado, fase: 'ultima-palabra' };
  }
  return terminar(conExpulsado, desenlace);
}

/** Cierra la ronda, reparte el punto y deja la mesa lista para otra. */
function terminar(state: ImpostorState, desenlace: Desenlace): ImpostorState {
  return {
    ...state,
    fase: 'fin',
    desenlace,
    marcador: marcadorTras(state, desenlace),
    rondasJugadas: state.rondasJugadas + 1,
  };
}

/**
 * Cuánto se deja hablar antes de votar.
 *
 * Cero es una opción, no un error: significa que no hay reloj y que el debate
 * lo corta el anfitrión cuando ve que la mesa ya ha dicho lo que tenía que
 * decir. Se limita por arriba para que una sala no se quede colgada un día.
 */
function segundosDe(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return SEGUNDOS_DE_DEBATE;
  return Math.min(Math.max(Math.round(valor), 0), 600);
}

function esModo(valor: unknown): valor is Modo {
  return typeof valor === 'string' && (MODOS as readonly string[]).includes(valor);
}

/** Los asientos que juegan, para que el servidor sortee sobre ellos. */
export function asientosQueJuegan(seats: readonly Seat[]): readonly SeatId[] {
  return seats.map((seat) => seat.id);
}
