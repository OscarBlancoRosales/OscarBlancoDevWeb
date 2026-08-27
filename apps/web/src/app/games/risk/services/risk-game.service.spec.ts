import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { GameConfig, GameState } from '@devweb/shared/engine/types';
import { RiskGameService } from './risk-game.service';
import { RiskRoomService, RoomMeta, RoomSeat, LoggedActionEntry } from './risk-room.service';
import { DEFAULT_CONFIG } from '@devweb/shared/engine/engine';
import { decideAction } from '@devweb/shared/engine/ai/bot-brain';
import { getMap } from '@devweb/shared/engine/maps/map-registry';

const MAPA = 'spain-regions';

function asiento(i: number, kind: 'human' | 'bot'): RoomSeat {
  return {
    id: `s${i}`,
    name: kind === 'bot' ? `Bot ${i}` : `Humano ${i}`,
    kind,
    seatToken: `t${i}`,
    color: '#fff',
    order: i,
    joinedAt: 0,
    lastSeen: 0,
    connected: true,
    isOwner: i === 0,
  };
}

function meta(config: Partial<GameConfig> = {}): RoomMeta {
  return {
    id: 'sala1',
    name: 'Mesa',
    mapId: MAPA,
    maxPlayers: 4,
    seed: 7,
    status: 'playing',
    createdAt: 0,
    updatedAt: 0,
    ownerUid: 'uid',
    ownerName: 'Óscar',
    config: { ...DEFAULT_CONFIG, ...config },
    inviteCode: 'abc',
  };
}

/**
 * Una sala de Firebase de mentira: el registro de acciones ES la partida, igual
 * que en la de verdad. Trae dos averías a mano para provocar los cuelgues.
 */
class SalaFalsa {
  meta$ = new BehaviorSubject<RoomMeta | null>(null);
  seats$ = new BehaviorSubject<RoomSeat[]>([]);
  snapshot$ = new BehaviorSubject<unknown>(null);
  log$ = new BehaviorSubject<LoggedActionEntry[]>([]);
  chats: Array<{ kind: string; text: string }> = [];
  listenToRoom = vi.fn();

  /** Avería 1: aceptar la jugada de este asiento pero no anotarla (rechazo). */
  tragarDe: string | null = null;
  tragarQuedan = 0;
  /** Avería 2: reventar al escribir, como un corte de red. */
  reventarEscrituras = 0;

  async pushAction(_room: string, action: unknown, by: string) {
    if (this.reventarEscrituras > 0) {
      this.reventarEscrituras--;
      throw new Error('sin conexión');
    }
    if (this.tragarQuedan > 0 && by === this.tragarDe) {
      this.tragarQuedan--;
      return; // el motor la rechazaría: se acepta y no se anota
    }
    const log = this.log$.value;
    this.log$.next([
      ...log,
      { key: `k${log.length}`, action, ts: log.length, by } as LoggedActionEntry,
    ]);
  }

  async sendChat(_room: string, entry: { kind: string; text: string }) {
    if (this.reventarEscrituras > 0) {
      this.reventarEscrituras--;
      throw new Error('sin conexión');
    }
    this.chats.push(entry);
  }

  // Los puntos de control son de verdad: sin ellos `deriveGame` reproduce el
  // registro entero en cada jugada y la mesa se arrastra.
  async writeSnapshot(_room: string, upTo: number, state: unknown) {
    this.snapshot$.next({ upTo, state });
  }
  async setStatus() {}
}

describe('RiskGameService: los bots no pueden dejar la mesa colgada', () => {
  let sala: SalaFalsa;
  let service: RiskGameService;
  let ultimo: GameState | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    sala = new SalaFalsa();
    service = new RiskGameService(sala as unknown as RiskRoomService);
    service.botDelayMs = 0;
    ultimo = null;
    service.state$.subscribe((state) => (ultimo = state));
  });

  /** Monta la mesa. El asiento 0 soy yo: hace falta un humano conectado para
   *  que haya anfitrión, y el anfitrión es quien mueve a los bots. */
  function montar(humanos: number, bots: number) {
    sala.seats$.next([
      ...Array.from({ length: humanos }, (_, i) => asiento(i, 'human')),
      ...Array.from({ length: bots }, (_, i) => asiento(humanos + i, 'bot')),
    ]);
    sala.meta$.next(meta());
    service.attach('sala1', 's0');
  }

  /**
   * Deja correr la mesa, jugando también el asiento humano.
   *
   * Importante: aquí NO se toca nada más. Si el servicio se queda parado, la
   * partida se queda parada, que es justo lo que hay que detectar.
   */
  async function dejarCorrer(veces = 8000): Promise<void> {
    const mapa = getMap(MAPA);
    for (let i = 0; i < veces; i++) {
      await Promise.resolve();
      vi.advanceTimersByTime(50);
      await Promise.resolve();
      if (ultimo?.phase === 'game-over') return;
      if (!ultimo) continue;
      const turno = ultimo.turnOrder[ultimo.currentPlayerIndex];
      if (turno !== 's0') continue;
      const accion = decideAction(ultimo, mapa, 's0');
      if (!accion) continue;
      await service.play(accion).catch(() => undefined);
    }
  }

  /** Avanza hasta que le toque a un bot, y devuelve su asiento. */
  async function esperarTurnoDeBot(): Promise<string> {
    const mapa = getMap(MAPA);
    for (let i = 0; i < 500; i++) {
      await Promise.resolve();
      vi.advanceTimersByTime(50);
      await Promise.resolve();
      if (!ultimo) continue;
      const turno = ultimo.turnOrder[ultimo.currentPlayerIndex];
      if (turno !== 's0') return turno;
      const accion = decideAction(ultimo, mapa, 's0');
      if (accion) await service.play(accion).catch(() => undefined);
    }
    throw new Error('nunca le tocó a un bot');
  }

  it('una mesa de bots llega al final sola', async () => {
    montar(1, 3);
    await dejarCorrer();
    expect(ultimo, 'no hay estado').toBeTruthy();
    expect(ultimo!.phase, `se quedó parada en la ronda ${ultimo!.round}`).toBe('game-over');
  }, 60000);

  it('un bot atascado en una fase no congela la mesa para siempre', async () => {
    // El cuelgue: la llave de "atascado" era `ronda:jugador`, SIN la fase. Al
    // rechazarle tres jugadas a un bot se marcaba su turno entero; se pasaba de
    // fase, la llave no cambiaba, y ese bot no volvía a mover NUNCA. Como el
    // turno tampoco pasaba, la mesa se quedaba muerta.
    montar(1, 3);
    const bot = await esperarTurnoDeBot();
    sala.tragarDe = bot;
    sala.tragarQuedan = 3;
    await dejarCorrer();
    expect(ultimo!.phase, `atascada en la ronda ${ultimo!.round}`).toBe('game-over');
  }, 60000);

  it('un fallo al escribir en la sala no mata la partida', async () => {
    // Aquí no se le da ningún empujón a la mesa a propósito: si el servicio
    // pierde el hilo de las jugadas, nadie se lo devuelve. Antes la excepción
    // salía de driveBots, se perdía el encadenado del final, y el bot no volvía
    // a mover en toda la partida.
    montar(1, 3);
    await esperarTurnoDeBot();
    sala.reventarEscrituras = 2;
    await dejarCorrer();
    expect(ultimo!.phase, `parada en la ronda ${ultimo!.round}`).toBe('game-over');
  }, 60000);

  it('las partidas pasan de la primera ronda', async () => {
    montar(1, 3);
    await dejarCorrer();
    expect(ultimo!.round, 'no pasó de la primera ronda').toBeGreaterThan(1);
  }, 60000);
});
