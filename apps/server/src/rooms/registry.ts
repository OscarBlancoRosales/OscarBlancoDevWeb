import { flotaModule } from '@devweb/shared/games/flota/index';
import { riskModule } from '@devweb/shared/games/risk';
import { trivialModule } from '@devweb/shared/games/trivial/index';
import { scrumModule } from '@devweb/shared/games/scrum';
import type { GameModule } from '@devweb/shared/games/module';
import type { GameId } from '@devweb/shared/contracts/rooms';

/**
 * Los juegos que el servidor sabe arbitrar.
 *
 * Añadir uno es escribir su `GameModule` y meterlo aquí. No hay nada más que
 * tocar: ni las salas, ni el WebSocket, ni la persistencia, ni las rutas.
 */
const JUEGOS = {
  scrum: scrumModule as GameModule<unknown, unknown>,
  risk: riskModule as GameModule<unknown, unknown>,
  flota: flotaModule as GameModule<unknown, unknown>,
  trivial: trivialModule as GameModule<unknown, unknown>,
} satisfies Partial<Record<GameId, GameModule<unknown, unknown>>>;

export type JuegoDisponible = keyof typeof JUEGOS;

export function moduleFor(game: GameId): GameModule<unknown, unknown> | null {
  return game in JUEGOS ? JUEGOS[game] : null;
}

export function juegosDisponibles(): readonly GameId[] {
  return Object.keys(JUEGOS) as GameId[];
}
