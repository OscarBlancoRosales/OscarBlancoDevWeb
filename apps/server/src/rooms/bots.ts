import type { GameModule, RuleError, Seat, SeatId } from '@devweb/shared/games/module';

/**
 * Un bot que encadena más jugadas seguidas que esto no está jugando: está
 * girando. Acertar en la flota da otro disparo, así que las rachas largas son
 * legítimas; doscientas, no.
 */
export const TOPE_JUGADAS_SEGUIDAS = 200;

/**
 * Lo que el conductor necesita de una sala.
 *
 * Es lo mínimo —quién se sienta, cómo está la partida y por dónde entran las
 * jugadas— para poder probarlo sin base de datos ni WebSocket. `RoomActor` la
 * cumple sin declararla.
 */
export interface MesaArbitrada {
  readonly asientos: readonly Seat[];
  readonly estado: unknown;
  submit(seatId: SeatId, accion: unknown): RuleError | null;
}

/**
 * Juega por los asientos que no tienen a nadie detrás.
 *
 * Las jugadas del bot entran por el mismo `submit` que las de una persona:
 * mismo esquema, misma validación, mismo log. Un bot no es un asiento de
 * confianza, es un asiento vacío, y saltarse la validación por él sería
 * abrirle al juego una puerta que el servidor existe para cerrar.
 *
 * Si la mesa rechaza una jugada suya, el conductor para. Reintentar sería pedir
 * lo mismo otra vez y recibir el mismo no.
 */
export function moverBots(
  mesa: MesaArbitrada,
  module: GameModule<unknown, unknown>,
  tope: number = TOPE_JUGADAS_SEGUIDAS,
): number {
  if (!module.botAction) return 0;

  let aplicadas = 0;

  while (aplicadas < tope) {
    const jugada = siguienteJugada(mesa, module);
    if (!jugada) break;
    if (mesa.submit(jugada.seatId, jugada.accion)) break;
    aplicadas += 1;
  }

  return aplicadas;
}

function siguienteJugada(
  mesa: MesaArbitrada,
  module: GameModule<unknown, unknown>,
): { seatId: SeatId; accion: unknown } | null {
  for (const asiento of mesa.asientos) {
    if (!asiento.isBot) continue;
    const accion = module.botAction?.(mesa.estado, asiento.id, mesa.asientos);
    if (accion !== null && accion !== undefined) return { seatId: asiento.id, accion };
  }
  return null;
}
