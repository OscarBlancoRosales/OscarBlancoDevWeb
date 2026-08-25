import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, combineLatest } from 'rxjs';
import { GameAction, GameMap, GameState } from '../engine/types';
import { currentPlayer, playerById } from '../engine/engine';
import { decideAction, StrategyBias } from '../engine/ai/bot-brain';
import { requestAdvice, requestTurnPlan } from '../engine/ai/ai-orchestrator';
import { chronicleFor, hasChronicle } from '../engine/ai/chronicle';
import { rngFor } from '../engine/rng';
import { AiSettings, loadAiSettings } from '../engine/ai/ai-client';
import { getMap } from '../engine/maps/map-registry';
import {
  ChatEntry,
  RiskRoomService,
  RoomMeta,
  RoomSeat,
  SNAPSHOT_EVERY,
} from './risk-room.service';
import { DerivedGame, deriveGame, electHostSeatId, shouldSnapshot } from './risk-sync';

/**
 * Cerebro de la mesa en el cliente.
 *
 * Une las tres piezas: el motor puro, la sala de Firebase y la IA. Además se
 * encarga del papel de *anfitrión*: el cliente elegido mueve los bots y guarda
 * los puntos de control. El resto solo miran y juegan lo suyo, con lo que nunca
 * hay dos clientes moviendo el mismo bot.
 */

@Injectable({ providedIn: 'root' })
export class RiskGameService implements OnDestroy {
  private subscription?: Subscription;
  private map: GameMap | null = null;

  private stateSubject = new BehaviorSubject<GameState | null>(null);
  private derivedSubject = new BehaviorSubject<DerivedGame | null>(null);
  private hostSubject = new BehaviorSubject<string | null>(null);
  private adviceSubject = new BehaviorSubject<ChatEntry[]>([]);
  private thinkingSubject = new BehaviorSubject<string | null>(null);

  readonly state$: Observable<GameState | null> = this.stateSubject.asObservable();
  readonly derived$: Observable<DerivedGame | null> = this.derivedSubject.asObservable();
  readonly hostSeatId$: Observable<string | null> = this.hostSubject.asObservable();
  /** Consejos del estratega: son personales, no se escriben en Firebase. */
  readonly advice$: Observable<ChatEntry[]> = this.adviceSubject.asObservable();
  /** Nombre del bot que está "pensando", para animar la interfaz. */
  readonly thinking$: Observable<string | null> = this.thinkingSubject.asObservable();

  /** Milisegundos entre jugadas de un bot: da tiempo a leer lo que pasa. */
  botDelayMs = loadBotDelay();
  aiSettings: AiSettings = loadAiSettings();

  private mySeatId = '';
  private roomId = '';
  private seats: RoomSeat[] = [];
  private meta: RoomMeta | null = null;
  private driving = false;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private plannedTurnKey = '';
  private advisedTurnKey = '';
  /** Jugadas seguidas de un bot que el motor ha rechazado. */
  private rejectedStreak = 0;
  private stuckTurnKey = '';
  private currentBias: StrategyBias | undefined;

  constructor(private rooms: RiskRoomService) {}

  /** Empieza a seguir una sala y a mantener el estado sincronizado. */
  attach(roomId: string, mySeatId: string): void {
    this.detach();
    this.roomId = roomId;
    this.mySeatId = mySeatId;
    this.rooms.listenToRoom(roomId);

    this.subscription = combineLatest([
      this.rooms.meta$,
      this.rooms.seats$,
      this.rooms.snapshot$,
      this.rooms.log$,
    ]).subscribe(([meta, seats, snapshot, log]) => {
      this.meta = meta;
      this.seats = seats;
      if (!meta) {
        this.stateSubject.next(null);
        this.derivedSubject.next(null);
        return;
      }
      try {
        this.map = getMap(meta.mapId);
      } catch {
        this.map = null;
        return;
      }

      const derived = deriveGame(meta, seats, snapshot, log, this.map);
      this.derivedSubject.next(derived);
      this.stateSubject.next(derived.state);
      this.hostSubject.next(electHostSeatId(seats));

      if (derived.state) this.afterStateUpdate(derived, snapshot?.upTo ?? 0);
    });
  }

  detach(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.driving = false;
    this.plannedTurnKey = '';
    this.advisedTurnKey = '';
    this.stuckTurnKey = '';
    this.rejectedStreak = 0;
    this.currentBias = undefined;
    this.stateSubject.next(null);
    this.derivedSubject.next(null);
    this.thinkingSubject.next(null);
  }

  ngOnDestroy(): void {
    this.detach();
  }

  get isHost(): boolean {
    return this.hostSubject.value === this.mySeatId && !!this.mySeatId;
  }

  get currentMap(): GameMap | null {
    return this.map;
  }

  /** Envía una acción del jugador local al log compartido. */
  async play(action: GameAction): Promise<void> {
    if (!this.roomId) return;
    await this.rooms.pushAction(this.roomId, action, this.mySeatId);
  }

  // ===== TAREAS DEL ANFITRIÓN =====

  private afterStateUpdate(derived: DerivedGame, snapshotUpTo: number): void {
    const state = derived.state!;
    // En la sala de espera ya hay un estado calculado (para la vista previa),
    // pero nadie debe mover ficha hasta que se pulse "Empezar".
    if (this.meta?.status !== 'playing' && this.meta?.status !== 'finished') {
      this.thinkingSubject.next(null);
      return;
    }
    if (!this.isHost || !this.map) {
      this.maybeAdvise(state);
      return;
    }

    if (shouldSnapshot(derived.applied, snapshotUpTo, SNAPSHOT_EVERY)) {
      void this.rooms.writeSnapshot(this.roomId, derived.applied, state);
    }

    if (state.phase === 'game-over') {
      if (this.meta?.status !== 'finished') void this.rooms.setStatus(this.roomId, 'finished');
      this.thinkingSubject.next(null);
      return;
    }

    this.maybeChronicle(state);
    this.maybeAdvise(state);
    void this.driveBots(state);
  }

  /**
   * Crónica de guerra de los escenarios históricos.
   *
   * Una línea la primera vez que se ataca cada pareja de provincias en un turno:
   * una batalla larga son muchas tiradas, y contar cada una llenaría el chat de
   * ruido. La escribe solo el anfitrión, como los mensajes de los bots, para que
   * no salga repetida en cada cliente.
   */
  private maybeChronicle(state: GameState): void {
    if (!this.map || !hasChronicle(this.map)) return;
    const combat = state.lastCombat;
    if (!combat) return;

    const key = `${state.round}:${state.currentPlayerIndex}:${combat.from}->${combat.to}`;
    if (this.chronicled.has(key)) return;
    this.chronicled.add(key);
    // El turno cambia a menudo; no dejamos crecer el conjunto sin límite.
    if (this.chronicled.size > 400) this.chronicled.clear();

    const line = chronicleFor(
      {
        map: this.map,
        state,
        playerId: combat.attackerId,
        from: combat.from,
        to: combat.to,
      },
      rngFor(state.seed, state.actionCount, 'chronicle'),
    );
    if (!line) return;

    void this.rooms.sendChat(this.roomId, {
      authorId: 'chronicle',
      author: 'Crónica',
      kind: 'system',
      text: line,
    });
  }

  private chronicled = new Set<string>();

  /** Si el turno es de un bot, planifica y juega una acción cada vez. */
  private async driveBots(state: GameState): Promise<void> {
    if (this.driving || !this.map) return;
    const player = currentPlayer(state);
    if (!player || player.kind !== 'bot' || player.eliminated) {
      this.thinkingSubject.next(null);
      return;
    }

    const currentTurnKey = `${state.round}:${state.currentPlayerIndex}`;
    // Si un bot se atasca (propone algo que el motor rechaza), no lo repetimos
    // en bucle: eso llenaría el log de basura y dejaría la mesa colgada.
    if (this.stuckTurnKey === currentTurnKey) return;

    this.driving = true;
    try {
      const turnKey = currentTurnKey;
      if (this.plannedTurnKey !== turnKey) {
        this.plannedTurnKey = turnKey;
        this.thinkingSubject.next(player.name);
        const plan = await requestTurnPlan(state, this.map, player.id, this.aiSettings);
        this.currentBias = plan.bias;
        await this.rooms.sendChat(this.roomId, {
          authorId: player.id,
          author: player.name,
          kind: 'bot',
          text: plan.message,
          origin: plan.source,
        });
      }

      const action = decideAction(state, this.map, player.id, this.currentBias);
      this.thinkingSubject.next(player.name);
      if (!action) {
        this.thinkingSubject.next(null);
        return;
      }

      await new Promise<void>((resolve) => {
        this.pendingTimer = setTimeout(resolve, this.botDelayMs);
      });

      const before = this.stateSubject.value?.actionCount ?? state.actionCount;
      await this.rooms.pushAction(this.roomId, action, player.id);
      const after = this.stateSubject.value?.actionCount ?? before;

      if (after === before) {
        this.rejectedStreak++;
        if (this.rejectedStreak >= 3) {
          this.stuckTurnKey = turnKey;
          this.thinkingSubject.next(null);
          await this.rooms.sendChat(this.roomId, {
            authorId: 'system',
            author: 'Sala',
            kind: 'system',
            text: `${player.name} no encuentra jugada válida y pasa el turno.`,
          });
          await this.rooms.pushAction(this.roomId, { type: 'end-phase', playerId: player.id }, player.id);
          return;
        }
      } else {
        this.rejectedStreak = 0;
      }
    } finally {
      this.driving = false;
    }

    // La actualización de estado que provoca `pushAction` llega mientras
    // seguíamos "ocupados", así que encadenamos aquí la siguiente jugada.
    // `driveBots` vuelve a comprobar de quién es el turno, así que parar es
    // simplemente que el turno deje de ser de un bot.
    const latest = this.stateSubject.value;
    if (latest && latest.phase !== 'game-over' && this.isHost) {
      void this.driveBots(latest);
    }
  }

  /** Consejo del estratega para el jugador local al empezar cada fase suya. */
  private maybeAdvise(state: GameState): void {
    if (!this.map || !this.mySeatId) return;
    const player = currentPlayer(state);
    if (!player || player.id !== this.mySeatId || player.kind !== 'human') return;

    const key = `${state.round}:${state.currentPlayerIndex}:${state.phase}`;
    if (this.advisedTurnKey === key) return;
    this.advisedTurnKey = key;

    const map = this.map;
    void requestAdvice(state, map, player.id, this.aiSettings).then((advice) => {
      const entry: ChatEntry = {
        key: `advice-${key}`,
        authorId: 'advisor',
        author: 'Estratega IA',
        kind: 'advisor',
        text: advice.message,
        ts: Date.now(),
        origin: advice.source,
      };
      const current = this.adviceSubject.value;
      if (current.some((item) => item.key === entry.key)) return;
      this.adviceSubject.next([...current.slice(-30), entry]);
    });
  }

  /** Pide un consejo bajo demanda (botón "pedir consejo"). */
  async askAdvisor(): Promise<void> {
    const state = this.stateSubject.value;
    if (!state || !this.map || !this.mySeatId) return;
    const advice = await requestAdvice(state, this.map, this.mySeatId, this.aiSettings);
    const entry: ChatEntry = {
      key: `advice-manual-${Date.now()}`,
      authorId: 'advisor',
      author: 'Estratega IA',
      kind: 'advisor',
      text: advice.message,
      ts: Date.now(),
      origin: advice.source,
    };
    this.adviceSubject.next([...this.adviceSubject.value.slice(-30), entry]);
  }

  updateAiSettings(settings: AiSettings): void {
    this.aiSettings = settings;
  }

  /** Cambia (y recuerda) el ritmo al que juegan los bots. */
  setBotDelay(ms: number): void {
    this.botDelayMs = Math.max(0, Math.min(4000, Math.round(ms)));
    saveBotDelay(this.botDelayMs);
  }

  /** Jugador cuyo turno es, resuelto contra la lista de asientos. */
  seatOf(state: GameState | null, seatId: string): RoomSeat | undefined {
    if (!state) return undefined;
    return this.seats.find((seat) => seat.id === seatId);
  }

  playerName(state: GameState | null, playerId: string): string {
    if (!state) return '';
    return playerById(state, playerId)?.name ?? playerId;
  }
}


const BOT_DELAY_KEY = 'risk_bot_delay';

/** Ritmos disponibles para los bots, de más rápido a más pausado. */
export const BOT_SPEEDS: Array<{ label: string; ms: number }> = [
  { label: 'Rápido', ms: 250 },
  { label: 'Normal', ms: 900 },
  { label: 'Pausado', ms: 1800 },
];

export function loadBotDelay(storage: Storage | undefined = safeStorage()): number {
  const raw = storage?.getItem(BOT_DELAY_KEY);
  const value = raw === null || raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.min(4000, value)) : 900;
}

export function saveBotDelay(ms: number, storage: Storage | undefined = safeStorage()): void {
  storage?.setItem(BOT_DELAY_KEY, String(ms));
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
