import type { GameMap, GameState, PlayerId, TerritoryId } from '../types';
import { playerById } from '../engine';
import { rngFor } from '../rng';
import { rankedAttacks, standings, traitsOf } from './bot-brain';

/**
 * Pactos: hablar con un rival tiene que servir de algo.
 *
 * Un pacto es que un bot acepte no atacar un territorio durante una ronda. No
 * es una regla del juego —el motor no se entera— sino una preferencia fuerte
 * en su cabeza: se le penaliza ese ataque, y si aun así sigue siendo el mejor
 * con diferencia, rompe su palabra. Como haría cualquiera.
 *
 * Se decide con el cerebro local y no con el modelo de lenguaje, y eso importa:
 * la mayoría de las partidas se juegan sin clave de IA, y un pacto que sólo
 * funcionara con clave sería una promesa a medias. El modelo, si lo hay, pone
 * las palabras; quién acepta y quién no lo decide la posición.
 */

/**
 * Cuántos pactos acepta un bot por ronda.
 *
 * Uno. Sin tope, una conversación podría desactivar a un rival entero a base
 * de mensajes, que es exactamente la partida que nadie quiere jugar.
 */
export const PACTOS_POR_RONDA = 1;

export interface PactProposal {
  /** Los territorios que se le pide no atacar, ya reconocidos en el mapa. */
  territories: TerritoryId[];
  accepted: boolean;
  /** Por qué, en palabras, para que la respuesta pueda decirlo. */
  reason: string;
}

/**
 * Qué territorios del mapa se mencionan en un texto.
 *
 * Compara sin acentos ni mayúsculas, porque nadie escribe «Illes Balears» con
 * la tilde correcta en mitad de una partida. De más largo a más corto, para que
 * «Castilla-La Mancha» gane a «Castilla y León» cuando ambas encajarían.
 */
export function territoriesMentioned(map: GameMap, text: string): TerritoryId[] {
  const limpio = plain(text);
  if (!limpio) return [];
  return map.territories
    .filter((territory) => territory.name.length >= 4)
    .sort((a, b) => b.name.length - a.name.length)
    .filter((territory) => limpio.includes(plain(territory.name)))
    .map((territory) => territory.id);
}

function plain(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Decide si un bot acepta no atacar lo que le piden.
 *
 * La regla es la de cualquier negociación: se acepta lo que cuesta poco. Si lo
 * que te piden es justo tu mejor jugada, no. Si el que lo pide va ganando,
 * tampoco: nadie regala tregua al líder. Y un perfil agresivo acepta menos que
 * uno cauto, porque para eso son perfiles distintos.
 */
export function considerPact(
  state: GameState,
  map: GameMap,
  botId: PlayerId,
  askerId: PlayerId,
  text: string,
): PactProposal {
  const bot = playerById(state, botId);
  const mentioned = territoriesMentioned(map, text);
  if (!bot || mentioned.length === 0) {
    return { territories: [], accepted: false, reason: 'no ha pedido nada concreto' };
  }

  // Sólo tiene sentido pactar sobre lo que el bot podría atacar de verdad.
  const attacks = rankedAttacks(state, map, botId, bot.botProfile);
  const alcanzables = mentioned.filter((id) => attacks.some((attack) => attack.to === id));
  if (alcanzables.length === 0) {
    return { territories: mentioned, accepted: true, reason: 'no pensaba ir por ahí' };
  }

  const mejor = attacks[0];
  if (mejor && alcanzables.includes(mejor.to)) {
    return { territories: alcanzables, accepted: false, reason: 'es justo por donde iba' };
  }

  const clasificacion = standings(state);
  if (clasificacion[0]?.playerId === askerId) {
    return { territories: alcanzables, accepted: false, reason: 'vas ganando tú' };
  }

  // El azar viene de la semilla y del número de acciones, así que la misma
  // partida contestaría lo mismo: nada de tirar una moneda distinta cada vez.
  const traits = traitsOf(bot.botProfile);
  const rng = rngFor(state.seed, state.actionCount, `pacto-${botId}`);
  const acepta = rng.next() > traits.aggression;
  return {
    territories: alcanzables,
    accepted: acepta,
    reason: acepta ? 'me sale a cuenta' : 'no me fío',
  };
}

/** Lo que el bot contesta cuando no hay modelo que ponga las palabras. */
export function pactReply(map: GameMap, pact: PactProposal): string {
  const nombres = pact.territories
    .map((id) => map.territories.find((t) => t.id === id)?.name ?? id)
    .join(' y ');
  if (pact.accepted) return `Trato hecho: esta ronda no toco ${nombres}. Pero sólo ésta.`;
  return `${nombres}, no. ${capitalize(pact.reason)}.`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
