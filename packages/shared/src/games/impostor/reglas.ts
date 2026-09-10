import type { SeatId } from '../module';
import type { Desenlace, ImpostorState, Modo } from './tipos';

/**
 * Las reglas, sueltas del motor.
 *
 * Todo lo de aquí son funciones puras sobre datos pequeños: se prueban sin
 * sala, sin servidor y sin mesa. El módulo las usa; ellas no saben que existe.
 */

/** Cuántos votos ha recibido cada uno. Solo cuenta a quien ha votado. */
export function recuento(votos: Readonly<Record<SeatId, SeatId>>): Record<SeatId, number> {
  const cuenta: Record<SeatId, number> = {};
  for (const votado of Object.values(votos)) {
    cuenta[votado] = (cuenta[votado] ?? 0) + 1;
  }
  return cuenta;
}

/**
 * A quién echa la mesa, o `null` si no se pone de acuerdo.
 *
 * El empate no se desempata: en este juego «no lo tenemos claro» es una
 * respuesta, y la respuesta la aprovecha el impostor. Desempatar por orden de
 * asiento castigaría a quien se sentó primero por haberse sentado primero.
 */
export function masVotado(votos: Readonly<Record<SeatId, SeatId>>): SeatId | null {
  const cuenta = recuento(votos);
  let mejor: SeatId | null = null;
  let maximo = 0;
  let empatados = 0;

  for (const [seatId, cuantos] of Object.entries(cuenta)) {
    if (cuantos > maximo) {
      maximo = cuantos;
      mejor = seatId;
      empatados = 1;
    } else if (cuantos === maximo) {
      empatados += 1;
    }
  }

  return empatados === 1 ? mejor : null;
}

/**
 * Cómo acaba la votación.
 *
 * Devuelve `null` cuando la partida todavía no ha terminado, que en la revancha
 * pasa justo al pillar al impostor: ahí empieza lo otro, no acaba nada.
 *
 * Con dos impostores basta con cazar a uno. Es una regla de la casa, y se
 * escribe para que se pueda discutir: obligar a cazar a los dos pediría varias
 * votaciones seguidas, y en una mesa de ocho eso es media hora de partida para
 * un juego que dura diez minutos.
 */
export function desenlaceDeLaVotacion(
  state: ImpostorState,
  expulsado: SeatId | null,
): Desenlace {
  if (expulsado === null) return 'impostores';
  if (!state.impostores.includes(expulsado)) return 'impostores';
  return state.modo === 'revancha' ? null : 'tripulacion';
}

/** Si esa palabra es la que buscaba el impostor. */
export function aciertaElDisparo(state: ImpostorState, opcion: number): boolean {
  return state.opciones[opcion] === state.palabra;
}

/**
 * Cuántos impostores caben en una mesa de ese tamaño.
 *
 * Dos impostores en una mesa de cinco es media mesa mintiendo, y entonces las
 * pistas dejan de significar nada. A partir de seis sí se sostiene.
 */
export function impostoresQueCaben(jugadores: number, pedidos: number): number {
  if (pedidos >= 2 && jugadores >= 6) return 2;
  return 1;
}

/** Quién gana puntos con ese desenlace. */
export function ganadoresDe(state: ImpostorState, desenlace: Desenlace): readonly SeatId[] {
  if (desenlace === 'impostores') return state.impostores;
  if (desenlace === 'tripulacion') {
    return state.orden.filter((seatId) => !state.impostores.includes(seatId));
  }
  return [];
}

/** El marcador después de repartir un punto a cada ganador. */
export function marcadorTras(
  state: ImpostorState,
  desenlace: Desenlace,
): Record<SeatId, number> {
  const marcador: Record<SeatId, number> = { ...state.marcador };
  for (const seatId of ganadoresDe(state, desenlace)) {
    marcador[seatId] = (marcador[seatId] ?? 0) + 1;
  }
  return marcador;
}

/** Si han votado todos los que juegan. */
export function hanVotadoTodos(state: ImpostorState): boolean {
  return state.orden.every((seatId) => seatId in state.votos);
}

/** La palabra que le toca a un asiento según su papel y el modo. */
export function palabraPara(
  modo: Modo,
  esImpostor: boolean,
  palabra: string,
  senuelo: string,
): string | null {
  if (!esImpostor) return palabra;
  return modo === 'infiltrado' ? senuelo : null;
}
