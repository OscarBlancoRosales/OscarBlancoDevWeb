import { FlotaAction } from './tipos';
import { flotaAleatoria, siguienteDisparo } from './bot';
import { rngFor } from '../../engine/rng';
import { disparar, flotaHundida, indice, punteria, tableroVacio, validarFlota } from './reglas';
import type { Barco, Bando, FlotaState, FlotaView, Nivel } from './tipos';
import type { GameModule, RuleError, SeatId } from '../module';

const NIVELES: readonly Nivel[] = ['novato', 'marino', 'almirante'];

/** La flota es un uno contra uno: dos bandos y quien llegue tarde, a mirar. */
const BANDOS = 2;

export const flotaModule: GameModule<FlotaState, FlotaAction> = {
  id: 'flota',
  actionSchema: FlotaAction,

  createState(_seats, config) {
    return {
      fase: 'colocacion',
      bandos: {},
      orden: [],
      turno: null,
      ganador: null,
      jugadas: 0,
      semilla: typeof config['semilla'] === 'number' ? config['semilla'] : 1,
      nivelBot: esNivel(config['nivelBot']) ? config['nivelBot'] : 'marino',
    };
  },

  validate(state, action, by) {
    switch (action.tipo) {
      case 'desplegar':
        if (state.fase !== 'colocacion' || state.orden.length >= BANDOS) {
          return { code: 'ya-no-se-coloca', message: 'Esta mesa ya está hecha.' };
        }
        if (by in state.bandos) {
          return { code: 'ya-desplegada', message: 'Tu flota ya está en el agua.' };
        }
        return validarFlota(action.barcos);

      case 'disparar': {
        if (state.fase === 'fin') return TERMINADA;
        if (state.fase !== 'combate') {
          return { code: 'aun-no-se-dispara', message: 'Todavía se están colocando las flotas.' };
        }
        if (state.turno !== by) {
          return { code: 'no-es-tu-turno', message: 'No es tu turno.' };
        }
        const rival = bandoRival(state, by);
        if (!rival) return { code: 'sin-rival', message: 'No hay rival al otro lado.' };
        if (rival.recibidos[indice(action.fila, action.columna)] !== null) {
          return { code: 'ya-disparado', message: 'Ahí ya has disparado.' };
        }
        return null;
      }

      case 'rendirse':
        if (state.fase === 'fin') return TERMINADA;
        return by in state.bandos ? null : { code: 'no-juegas', message: 'No estás jugando.' };
    }
  },

  apply(state, action, by) {
    const jugadas = state.jugadas + 1;

    switch (action.tipo) {
      case 'desplegar': {
        const orden = [...state.orden, by];
        const bandos = { ...state.bandos, [by]: nuevoBando(action.barcos) };
        const completa = orden.length === BANDOS;
        return {
          ...state,
          jugadas,
          orden,
          bandos,
          fase: completa ? 'combate' : 'colocacion',
          turno: completa ? (orden[0] ?? null) : null,
        };
      }

      case 'disparar': {
        const rivalId = idRival(state, by);
        const rival = rivalId ? bandoDe(state, rivalId) : undefined;
        if (!rivalId || !rival) return { ...state, jugadas };

        const { bando, resultado } = disparar(rival, action.fila, action.columna);
        const bandos = { ...state.bandos, [rivalId]: bando };

        if (flotaHundida(bando)) {
          return { ...state, jugadas, bandos, fase: 'fin', ganador: by, turno: null };
        }

        // Acertar da otro disparo: es la regla que convierte una racha en una
        // ventaja de verdad y la que hace que valga la pena rastrear.
        return { ...state, jugadas, bandos, turno: resultado === 'agua' ? rivalId : by };
      }

      case 'rendirse':
        return {
          ...state,
          jugadas,
          fase: 'fin',
          ganador: idRival(state, by),
          turno: null,
        };
    }
  },

  /**
   * Del rival solo sale la rejilla de lo que ya le has disparado.
   *
   * Sus barcos a flote no están cifrados ni escondidos en el cliente: no se
   * envían. Es todo el juego, así que es la única línea de este fichero que no
   * puede tener un mal día.
   */
  view(state, forSeat) {
    const tuyo = bandoDe(state, forSeat) ?? null;
    const rivalId = idRival(state, forSeat);
    const rival = rivalId ? bandoDe(state, rivalId) : undefined;
    const terminada = state.fase === 'fin';

    return {
      fase: state.fase,
      turno: state.turno,
      ganador: state.ganador,
      desplegados: state.orden,
      tuyo,
      rivalId,
      // Los disparos que yo he hecho son los que el rival ha recibido.
      disparosSobreRival: rival ? rival.recibidos : tableroVacio(),
      flotaRival: terminada && rival ? rival.barcos : null,
      punteriaTuya: terminada && rival ? punteria(rival) : null,
      punteriaRival: terminada && tuyo ? punteria(tuyo) : null,
    } satisfies FlotaView;
  },

  /**
   * Lo que haría un asiento sin nadie detrás.
   *
   * Coloca su flota en cuanto la sala arranca y dispara cuando le toca. Todo el
   * azar sale de la semilla y del número de jugada, así que reaplicar el log
   * reproduce la partida con los bots incluidos: es la condición para que la
   * foto que guarda el actor siga valiendo.
   */
  botAction(state, seat) {
    const rng = rngFor(state.semilla, state.jugadas, `flota:${seat}`);

    if (state.fase === 'colocacion') {
      if (seat in state.bandos || state.orden.length >= BANDOS) return null;
      return { tipo: 'desplegar', barcos: flotaAleatoria(rng) };
    }

    if (state.fase !== 'combate' || state.turno !== seat) return null;

    const rival = bandoRival(state, seat);
    if (!rival) return null;

    const { fila, columna } = siguienteDisparo(rival.recibidos, state.nivelBot, rng);
    return { tipo: 'disparar', fila, columna };
  },

  /**
   * Cerrar la pestaña no es rendirse.
   *
   * El asiento se recupera con el mismo pase y la partida sigue donde estaba.
   * Abandonar es una acción del juego y se hace a propósito.
   */
  onSeatLeave(state) {
    return state;
  },
};

const TERMINADA: RuleError = { code: 'partida-terminada', message: 'Esta partida ya ha acabado.' };

function nuevoBando(barcos: readonly Barco[]): Bando {
  return { barcos, recibidos: tableroVacio() };
}

/**
 * Quién juega contra ese asiento.
 *
 * Quien no está en `orden` está mirando, y quien mira no tiene rival: si esta
 * función le devolviera «el otro», la sala le enviaría los disparos de una
 * partida que no es suya.
 */
function idRival(state: FlotaState, seat: SeatId): SeatId | null {
  if (!state.orden.includes(seat)) return null;
  return state.orden.find((id) => id !== seat) ?? null;
}

function bandoRival(state: FlotaState, seat: SeatId): Bando | null {
  const rivalId = idRival(state, seat);
  return rivalId ? (bandoDe(state, rivalId) ?? null) : null;
}

/**
 * El bando de un asiento, si lo tiene.
 *
 * `Record<SeatId, Bando>` afirma que todo asiento tiene flota, y no es verdad:
 * quien mira la partida no la tiene. Esta función es donde se dice la verdad, y
 * por eso su tipo de retorno lleva el `undefined`.
 */
function bandoDe(state: FlotaState, seat: SeatId): Bando | undefined {
  return state.bandos[seat];
}

function esNivel(valor: unknown): valor is Nivel {
  return typeof valor === 'string' && (NIVELES as readonly string[]).includes(valor);
}
