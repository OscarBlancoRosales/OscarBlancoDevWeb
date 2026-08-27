import { Type } from '@sinclair/typebox';
import { applyAction, createGame } from '../engine/engine';
import { RISK_MAPS } from '../engine/maps/map-registry';
import { RuleError as EngineRuleError } from '../engine/types';
import type { GameAction, GameMap, GameState, PlayerState } from '../engine/types';
import type { PlayerSeed } from '../engine/engine';
import type { GameModule, RuleError, SeatId } from './module';

/**
 * Los tipos de acción que el motor entiende.
 *
 * El esquema solo comprueba la forma mínima: que sea un objeto con un `type`
 * conocido. Quien decide si la jugada es legal es el motor, que para eso tiene
 * 7.868 líneas de reglas y mil tests. Duplicar aquí la forma de las diez
 * acciones sería mantener el mismo contrato en dos sitios, y el día que se
 * separen ganaría el que menos sabe.
 */
const TIPOS_DE_ACCION = [
  'claim',
  'deploy',
  'undo-deploy',
  'trade',
  'attack',
  'occupy',
  'fortify',
  'upgrade',
  'end-phase',
  'surrender',
] as const;

export const RiskAction = Type.Object(
  {
    type: Type.Union(TIPOS_DE_ACCION.map((tipo) => Type.Literal(tipo))),
    playerId: Type.String({ minLength: 1, maxLength: 64 }),
  },
  { additionalProperties: true },
);

/** Lo que hace falta guardar en la sala para poder empezar una partida. */
export interface RiskConfig {
  readonly mapId: string;
  readonly seed: number;
}

/**
 * El estado que sale hacia un jugador.
 *
 * Es el estado real menos lo que ese jugador no debe saber.
 */
export type RiskView = Omit<GameState, 'players' | 'deck'> & {
  readonly players: readonly RiskPlayerView[];
  /** Cuántas cartas quedan por robar. No cuáles. */
  readonly deckSize: number;
};

export type RiskPlayerView = Omit<PlayerState, 'cards' | 'seatToken'> & {
  /** Las tuyas, si eres tú. Solo el número, si es otro. */
  readonly cards: PlayerState['cards'] | null;
  readonly cardCount: number;
};

export const riskModule: GameModule<GameState, GameAction> = {
  id: 'risk',
  actionSchema: RiskAction,

  createState(seats, config) {
    const { mapId, seed } = leerConfig(config);
    const map = mapaPorId(mapId);
    if (!map) throw new Error(`No existe el mapa ${mapId}`);

    const players: PlayerSeed[] = seats.map((seat) => ({
      id: seat.id,
      name: seat.displayName,
      kind: seat.isBot ? 'bot' : 'human',
    }));

    return createGame({ map, players, seed });
  },

  /**
   * Pregunta al motor si la jugada vale, aplicándola.
   *
   * El motor no dice "esto es ilegal": lanza. Y como es determinista —el azar
   * sale de `seed` y `actionCount`, que viven dentro del estado—, aplicarlo aquí
   * y volver a aplicarlo en `apply` da exactamente el mismo resultado. Cuesta
   * una pasada de más y ahorra tener las reglas escritas dos veces.
   */
  validate(state, action, by) {
    const suplantacion = suplantando(action, by);
    if (suplantacion) return suplantacion;

    const map = mapaPorId(state.mapId);
    if (!map) return { code: 'mapa-desconocido', message: 'El mapa de esta partida ya no existe.' };

    try {
      applyAction(state, action, map);
      return null;
    } catch (error) {
      if (error instanceof EngineRuleError) {
        return { code: error.code, message: error.message };
      }
      throw error;
    }
  },

  apply(state, action) {
    const map = mapaPorId(state.mapId);
    if (!map) throw new Error(`No existe el mapa ${state.mapId}`);
    return applyAction(state, action, map);
  },

  /**
   * Las cartas de los demás no salen del servidor.
   *
   * En RISK saber la mano ajena es saber cuándo va a canjear y con cuántos
   * refuerzos aparece: es exactamente la información que hace que merezca la
   * pena mirar. Con las reglas en Firebase estaban a la vista de cualquiera.
   */
  view(state, forSeat) {
    const { deck: _deck, players, ...resto } = state;
    return {
      ...resto,
      deckSize: state.deck.length,
      players: players.map((player) => verJugador(player, forSeat)),
    } satisfies RiskView;
  },

  /**
   * Irse de la mesa no es abandonar la partida.
   *
   * Cerrar la pestaña en mitad de un RISK es lo más normal del mundo, y el
   * asiento se recupera con el mismo pase. Rendirse es una acción del juego, y
   * se hace a propósito.
   */
  onSeatLeave(state) {
    return state;
  },
};

function verJugador(player: PlayerState, forSeat: SeatId): RiskPlayerView {
  const { cards, seatToken: _token, ...resto } = player;
  const propio = player.id === forSeat;
  return {
    ...resto,
    cards: propio ? cards : null,
    cardCount: cards.length,
  };
}

/**
 * Nadie juega en nombre de otro.
 *
 * Cada acción del motor lleva dentro un `playerId`, y ese campo lo escribe el
 * cliente. El motor comprueba que a ese jugador le toque, pero no puede
 * comprobar quién ha mandado el mensaje: para él, la acción llega sin remite.
 *
 * Sin esta línea, bastaría con mandar la jugada del rival cuando le toca a él
 * para jugarle el turno entero. Es exactamente el agujero que un servidor
 * autoritativo existe para tapar, y el único que el motor compartido no puede
 * tapar solo.
 */
function suplantando(action: GameAction, by: SeatId): RuleError | null {
  return action.playerId === by
    ? null
    : { code: 'no-eres-tu', message: 'No puedes jugar en nombre de otro.' };
}

function mapaPorId(mapId: string): GameMap | undefined {
  return RISK_MAPS.find((map) => map.id === mapId);
}

function leerConfig(config: Readonly<Record<string, unknown>>): RiskConfig {
  const mapId = typeof config['mapId'] === 'string' ? config['mapId'] : 'world';
  const seed = typeof config['seed'] === 'number' ? config['seed'] : 1;
  return { mapId, seed };
}

/** Los mapas que se pueden elegir al crear una sala. */
export function mapasDisponibles(): readonly { id: string; name: string; maxPlayers: number }[] {
  return RISK_MAPS.map((map) => ({ id: map.id, name: map.name, maxPlayers: map.maxPlayers }));
}
