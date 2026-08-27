import { GameConfig, GameMap, GameState } from '@devweb/shared/engine/types';
import { PlayerSeed, applyAction, createGame } from '@devweb/shared/engine/engine';
import { LoggedActionEntry, RoomMeta, RoomSeat, RoomSnapshot, RosterEntry } from './risk-room.service';

/**
 * Reconstrucción del estado a partir de lo que hay en Firebase.
 *
 * Es una función pura: mismo snapshot y mismo log => mismo estado en todos los
 * clientes. Aquí vive el contrato del lockstep, y por eso está separada del
 * servicio de Angular: se puede testear sin tocar la red.
 */

export interface DerivedGame {
  state: GameState | null;
  /** Cuántas entradas del log se han incorporado (snapshot incluido). */
  applied: number;
  /** Acciones descartadas por ilegales, con su motivo. */
  rejected: Array<{ entry: LoggedActionEntry; reason: string }>;
  error: string | null;
}

/** Convierte los asientos de la sala en jugadores del motor. */
export function seatsToPlayers(seats: readonly RoomSeat[]): PlayerSeed[] {
  return [...seats]
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
    .map((seat) => ({
      id: seat.id,
      name: seat.name,
      kind: seat.kind,
      ...(seat.botProfile !== undefined && { botProfile: seat.botProfile }),
      seatToken: seat.seatToken,
      color: seat.color,
    }));
}

/** Convierte la alineación congelada en jugadores del motor. */
export function rosterToPlayers(roster: readonly RosterEntry[]): PlayerSeed[] {
  return roster.map((entry) => ({
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    ...(entry.botProfile !== undefined && { botProfile: entry.botProfile }),
    seatToken: entry.seatToken,
    color: entry.color,
  }));
}

/** Construye la alineación a congelar a partir de los asientos actuales. */
export function seatsToRoster(seats: readonly RoomSeat[]): RosterEntry[] {
  return [...seats]
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
    .map((seat) => ({
      id: seat.id,
      name: seat.name,
      kind: seat.kind,
      ...(seat.botProfile !== undefined && { botProfile: seat.botProfile }),
      color: seat.color,
      seatToken: seat.seatToken,
    }));
}

/**
 * Estado inicial de la partida tal y como lo calculará cualquier cliente.
 * Si hay alineación congelada se usa esa; si no (sala aún en espera), los
 * asientos actuales.
 */
export function initialStateFor(
  meta: RoomMeta,
  seats: readonly RoomSeat[],
  map: GameMap,
  config?: GameConfig,
): GameState {
  const players = meta.roster?.length ? rosterToPlayers(meta.roster) : seatsToPlayers(seats);
  return createGame({
    map,
    players,
    seed: meta.seed,
    config: config ?? meta.config,
  });
}

/**
 * Aplica el log sobre el último punto de control.
 * Las acciones ilegales se descartan (mismo criterio en todos los clientes),
 * de forma que una jugada duplicada o fuera de tiempo nunca rompe la partida.
 */
export function deriveGame(
  meta: RoomMeta | null,
  seats: readonly RoomSeat[],
  snapshot: RoomSnapshot | null,
  log: readonly LoggedActionEntry[],
  map: GameMap,
): DerivedGame {
  const rejected: DerivedGame['rejected'] = [];
  if (!meta || seats.length < 2) {
    return { state: null, applied: 0, rejected, error: null };
  }

  let state: GameState;
  let startIndex = 0;

  if (snapshot?.state) {
    state = snapshot.state;
    startIndex = Math.min(snapshot.upTo, log.length);
  } else {
    try {
      state = initialStateFor(meta, seats, map);
    } catch (error) {
      return { state: null, applied: 0, rejected, error: (error as Error).message };
    }
  }

  for (let i = startIndex; i < log.length; i++) {
    const entry = log[i];
    try {
      state = applyAction(state, entry.action, map);
    } catch (error) {
      rejected.push({ entry, reason: (error as Error).message });
    }
  }

  return { state, applied: log.length, rejected, error: null };
}

/**
 * Quién manda en la partida (mueve los bots y guarda los puntos de control).
 * Se elige de forma determinista para que solo haya un anfitrión a la vez:
 * el propietario si está conectado; si no, el asiento humano conectado más
 * antiguo. Si no queda ningún humano, nadie mueve: la partida queda en pausa.
 */
export function electHostSeatId(seats: readonly RoomSeat[]): string | null {
  const connectedHumans = seats
    .filter((seat) => seat.kind === 'human' && seat.connected)
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  if (connectedHumans.length === 0) return null;
  const owner = connectedHumans.find((seat) => seat.isOwner);
  return (owner ?? connectedHumans[0]).id;
}

/** ¿Toca guardar punto de control? */
export function shouldSnapshot(applied: number, snapshotUpTo: number, every: number): boolean {
  if (every <= 0) return false;
  return applied - snapshotUpTo >= every;
}
