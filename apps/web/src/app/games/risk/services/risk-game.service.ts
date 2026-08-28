import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, combineLatest } from 'rxjs';
import { GameAction, GameMap, GameState } from '@devweb/shared/engine/types';
import { currentPlayer, playerById } from '@devweb/shared/engine/engine';
import { decideAction, StrategyBias } from '@devweb/shared/engine/ai/bot-brain';
import {
  requestAdvice,
  requestChronicle,
  requestReply,
  requestTurnPlan,
} from '@devweb/shared/engine/ai/ai-orchestrator';
import { chronicleFor, hasChronicle } from '@devweb/shared/engine/ai/chronicle';
import { rngFor } from '@devweb/shared/engine/rng';
import {
  AiSettings,
  fetchBundledKeys,
  hasStoredAiSettings,
  loadAiSettings,
  withBundledKey,
} from '@devweb/shared/engine/ai/ai-client';
import { getMap } from '@devweb/shared/engine/maps/map-registry';
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

/**
 * La jugada más tonta que el motor no puede rechazar, para desatascar un turno.
 *
 * Es la salida de emergencia, no una estrategia: se usa sólo cuando el bot no
 * propone nada o cuando lo que propone no llega a la sala. Lo importante es que
 * SIEMPRE sea legal, porque el sitio del que hay que salir es justo aquel en el
 * que ninguna jugada entra.
 *
 * En reclutamiento no vale `end-phase`: el motor lo rechaza mientras quede
 * reserva sin colocar, y ese fue el cuelgue. Se coloca un ejército en un
 * territorio propio, que siempre se puede.
 */
function escapeAction(state: GameState, playerId: string): GameAction | null {
  const player = playerById(state, playerId);
  if (!player) return null;

  if (state.phase === 'reinforce' && player.reserve > 0) {
    const mine = Object.entries(state.territories).find(
      ([, territory]) => territory.ownerId === playerId,
    );
    if (mine) {
      return { type: 'deploy', playerId, territoryId: mine[0], armies: 1 };
    }
  }

  return { type: 'end-phase', playerId };
}

@Injectable({ providedIn: 'root' })
export class RiskGameService implements OnDestroy {
  private subscription: Subscription | undefined;
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

  /**
   * Completa los ajustes con la clave que venga con el despliegue, si la hay.
   *
   * Se hace una sola vez y sin bloquear nada: si el fichero no existe, la IA se
   * queda como estaba y el juego sigue con el cerebro local, que es lo de
   * siempre.
   */
  private async adoptBundledKey(): Promise<void> {
    if (this.bundledChecked) return;
    this.bundledChecked = true;
    const untouched = !hasStoredAiSettings();
    const bundled = await fetchBundledKeys();
    this.aiSettings = withBundledKey(this.aiSettings, bundled, { untouched });
  }

  private bundledChecked = false;

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
  /** Llave de la fase en la que se contaron esos rechazos. */
  private rejectedKey = '';
  /**
   * Fases que ya hemos dado por imposibles y hemos saltado.
   *
   * Es un conjunto, no un valor suelto, y la llave lleva la FASE dentro. Antes
   * era `ronda:jugador` a secas, y ahí estaba el cuelgue: al atascarse un bot
   * en refuerzos marcábamos su turno entero, pasábamos de fase, y como la llave
   * no cambiaba el bot ya no volvía a mover NUNCA. La mesa se quedaba muerta y
   * no había forma de continuar.
   */
  private skippedPhases = new Set<string>();
  /** Privados a bots que ya se han contestado, para no contestar dos veces. */
  private answered = new Set<string>();
  /** La primera emisión del chat es historia, no mensajes nuevos. */
  private chatIsHistory = true;
  private chatSubscription: Subscription | undefined;
  private currentBias: StrategyBias | undefined;

  constructor(private rooms: RiskRoomService) {}

  /** Empieza a seguir una sala y a mantener el estado sincronizado. */
  attach(roomId: string, mySeatId: string): void {
    this.detach();
    this.roomId = roomId;
    this.mySeatId = mySeatId;
    void this.adoptBundledKey();
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

    this.chatSubscription = this.rooms.chat$.subscribe((chat) => {
      this.answerDirectMessages(chat);
    });
  }

  /**
   * Contesta a los privados dirigidos a un bot.
   *
   * Sólo lo hace el anfitrión, por la misma razón por la que sólo él mueve a
   * los bots: si contestara cada navegador, un mensaje tendría tantas
   * respuestas como gente hubiera mirando la partida.
   */
  private answerDirectMessages(chat: ChatEntry[]): void {
    // Lo que ya estaba escrito al entrar no se contesta: si no, abrir una sala
    // vieja dispararía una ráfaga de respuestas a conversaciones de ayer.
    if (this.chatIsHistory) {
      this.chatIsHistory = false;
      for (const entry of chat) this.answered.add(entry.key);
      return;
    }

    if (!this.isHost || !this.map) return;
    const state = this.stateSubject.value;
    if (!state || state.phase === 'game-over') return;

    for (const entry of chat.slice(-10)) {
      if (entry.kind !== 'player' || !entry.to) continue;
      if (this.answered.has(entry.key)) continue;
      const seat = this.seats.find((candidate) => candidate.id === entry.to);
      if (!seat || seat.kind !== 'bot') continue;
      this.answered.add(entry.key);
      void this.replyAsBot(entry, seat);
    }
  }

  private async replyAsBot(entry: ChatEntry, seat: RoomSeat): Promise<void> {
    const state = this.stateSubject.value;
    if (!state || !this.map) return;
    const answer = await requestReply(state, this.map, seat.id, entry.text, this.aiSettings);
    await this.rooms.sendChat(this.roomId, {
      authorId: seat.id,
      author: seat.name,
      kind: 'bot',
      text: answer.message,
      origin: answer.source,
      to: entry.authorId,
    });
  }

  detach(): void {
    this.subscription?.unsubscribe();
    this.chatSubscription?.unsubscribe();
    this.chatSubscription = undefined;
    this.answered.clear();
    this.chatIsHistory = true;
    this.subscription = undefined;
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.driving = false;
    this.plannedTurnKey = '';
    this.advisedTurnKey = '';
    this.skippedPhases.clear();
    this.rejectedStreak = 0;
    this.rejectedKey = '';
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

    const context = {
      map: this.map,
      state,
      playerId: combat.attackerId,
      from: combat.from,
      to: combat.to,
    };
    const line = chronicleFor(context, rngFor(state.seed, state.actionCount, 'chronicle'));
    if (!line) return;

    // El modelo reescribe la nota; si no hay o falla, va la local tal cual.
    void requestChronicle(context, line, this.aiSettings).then((result) =>
      this.rooms.sendChat(this.roomId, {
        authorId: 'chronicle',
        author: 'Crónica',
        kind: 'system',
        text: result.message,
        origin: result.source,
      }),
    );
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

    // El turno sirve para pedir UN plan a la IA; la fase, para saber si nos
    // hemos atascado. Son llaves distintas a propósito: si el plan se pidiera
    // por fase gastaríamos el triple de peticiones, y los modelos gratuitos
    // devuelven 429 en cuanto se les aprieta.
    const turnKey = `${state.round}:${state.currentPlayerIndex}`;
    const phaseKey = `${turnKey}:${state.phase}`;
    if (this.skippedPhases.has(phaseKey)) return;

    this.driving = true;
    try {
      if (this.plannedTurnKey !== turnKey) {
        this.plannedTurnKey = turnKey;
        this.thinkingSubject.next(player.name);
        // El plan es ambiente, no reglas: si la IA no contesta el bot juega
        // igual con su cabeza de siempre. Antes un 429 tiraba la excepción
        // fuera de `driveBots`, se perdía el encadenado del final y el bot no
        // volvía a mover en toda la partida.
        try {
          const plan = await requestTurnPlan(state, this.map, player.id, this.aiSettings);
          this.currentBias = plan.bias;
          await this.rooms.sendChat(this.roomId, {
            authorId: player.id,
            author: player.name,
            kind: 'bot',
            text: plan.message,
            origin: plan.source,
          });
        } catch {
          this.currentBias = undefined;
        }
      }

      const action =
        decideAction(state, this.map, player.id, this.currentBias) ??
        escapeAction(state, player.id);
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
        // Los rechazos se cuentan por fase: arrastrarlos de una a otra hacía
        // que un tropiezo en refuerzos condenara al ataque siguiente.
        if (this.rejectedKey !== phaseKey) {
          this.rejectedKey = phaseKey;
          this.rejectedStreak = 0;
        }
        this.rejectedStreak++;
        // A la tercera se prueba la salida de emergencia: una jugada que el
        // motor NO puede rechazar. Antes se mandaba `end-phase` a secas, y en
        // reclutamiento eso se rechaza si queda reserva por colocar: la fase
        // quedaba marcada como imposible, la jugada tampoco entraba, y la mesa
        // se moría ahí. Hay que salir por donde el motor deja salir.
        if (this.rejectedStreak >= 3) {
          const escape = escapeAction(state, player.id);
          if (escape) await this.rooms.pushAction(this.roomId, escape, player.id);
          if (this.rejectedStreak === 3) {
            await this.rooms.sendChat(this.roomId, {
              authorId: 'system',
              author: 'Sala',
              kind: 'system',
              text: `${player.name} no consigue mover y sale como puede.`,
            });
          }
        }
        // Nunca se da una fase por perdida para siempre: si lo que falla es la
        // escritura, la jugada era buena y hay que reintentarla. Sólo se deja
        // de insistir cuando la mesa lleva demasiado sin moverse, y aun así
        // basta con que cambie el estado para volver a intentarlo.
        if (this.rejectedStreak >= 40) {
          this.skippedPhases.add(phaseKey);
          this.thinkingSubject.next(null);
        }
      } else {
        this.rejectedStreak = 0;
      }
    } catch {
      // Un corte de red al escribir en la sala tampoco puede matar la partida.
      // Se suelta el turno y el siguiente cambio de estado lo reintenta.
      this.thinkingSubject.next(null);
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
