import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TerminalLayout } from '../../../../shared/terminal-layout/terminal-layout';
import { RiskBoard } from '../risk-board/risk-board';
import { RiskHud } from '../risk-hud/risk-hud';
import { RiskPanel } from '../risk-panel/risk-panel';
import { PanelId } from '../panel-id';
import {
  COMMANDERS,
  Commander,
  botPortrait,
  commanderById,
} from '../../commanders';
import { CardView, RiskCards } from '../risk-cards/risk-cards';
import {
  CANAL_GENERAL,
  ChatLine,
  RiskRoster,
  RosterRow,
} from '../risk-roster/risk-roster';

import {
  ChatEntry,
  RiskRoomService,
  RoomMeta,
  RoomSeat,
} from '../../services/risk-room.service';
import { BOT_SPEEDS, RiskGameService } from '../../services/risk-game.service';
import { DerivedGame, seatsToRoster } from '../../services/risk-sync';
import { getMap } from '@devweb/shared/engine/maps/map-registry';
import {
  Card,
  GameMap,
  GameState,
  PlayerState,
  TerritoryId,
} from '@devweb/shared/engine/types';
import {
  PLAYER_COLORS,
  currentPlayer,
  legalActionTypes,
  mustTrade,
  playerById,
} from '@devweb/shared/engine/engine';
import {
  areConnected,
  attackSources,
  attackTargets,
  reinforcementBreakdown,
  territoriesOf,
} from '@devweb/shared/engine/rules';
import { conquestOdds, maxAttackDice } from '@devweb/shared/engine/combat';
import { approachOf, battleRulesFor, TERRAIN_META } from '@devweb/shared/engine/terrain';
import { hasUnit, infantryOf, UNIT_KINDS, UNIT_META } from '@devweb/shared/engine/units';
import { NarratorService, TTS_VOICES } from '../../services/narrator';
import { missionProgress } from '@devweb/shared/engine/missions';
import { CARD_ICON, CARD_LABEL, isValidSet } from '@devweb/shared/engine/cards';
import { BOT_PROFILES, BOT_PROFILE_IDS, standings } from '@devweb/shared/engine/ai/bot-brain';
import { BotProfile } from '@devweb/shared/engine/types';
import {
  AiSettings,
  FREE_MODELS,
  PROVIDER_LABELS,
  PROVIDER_SIGNUP,
  AiProvider,
  loadAiSettings,
  saveAiSettings,
} from '@devweb/shared/engine/ai/ai-client';

type Panel = 'chat' | 'eventos' | 'cartas' | 'ia';

/** El estratega no es un jugador, pero tiene ficha propia en la lista. */
const HILO_ESTRATEGA = 'advisor';

/** El estratega tampoco tiene cara: es un consejero, no un rival. */
const GLIFO_ESTRATEGA = '🧠';

/**
 * La mesa: sala de espera y partida en el mismo sitio.
 * Aquí se junta todo: tablero, reglas, chat, IA y los controles del turno.
 */
@Component({
  selector: 'app-risk-room',
  imports: [
    CommonModule,
    FormsModule,
    TerminalLayout,
    RiskBoard,
    RiskHud,
    RiskRoster,
    RiskPanel,
    RiskCards,
  ],
  templateUrl: './risk-room.html',
  styleUrl: './risk-room.css',
})
export class RiskRoom implements OnInit, OnDestroy {
  roomId = '';
  seatId = '';
  meta: RoomMeta | null = null;
  seats: RoomSeat[] = [];
  state: GameState | null = null;
  derived: DerivedGame | null = null;
  map: GameMap | null = null;
  chat: ChatEntry[] = [];
  advice: ChatEntry[] = [];
  hostSeatId: string | null = null;
  thinking: string | null = null;

  // Selección en el tablero
  selectedFrom: TerritoryId | null = null;
  selectedTo: TerritoryId | null = null;
  deployAmount = 1;
  attackDice = 3;
  occupyArmies = 1;
  fortifyArmies = 1;
  selectedCards: string[] = [];

  panel: Panel = 'chat';
  copied = false;
  errorMessage = '';
  showNames = true;

  // Configuración de IA
  aiSettings: AiSettings = loadAiSettings();
  readonly providerLabels = PROVIDER_LABELS;
  readonly providerSignup = PROVIDER_SIGNUP;
  readonly providers: AiProvider[] = ['openrouter', 'groq', 'gemini', 'openai-compatible'];
  readonly botProfiles = BOT_PROFILE_IDS;
  readonly profileInfo = BOT_PROFILES;
  newBotProfile: BotProfile = 'oportunista';

  readonly botSpeeds = BOT_SPEEDS;
  botDelay = 900;

  readonly cardIcon = CARD_ICON;
  readonly cardLabel = CARD_LABEL;

  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rooms: RiskRoomService,
    private game: RiskGameService,
    public narrator: NarratorService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.roomId =
      this.route.snapshot.queryParamMap.get('room') ?? localStorage.getItem('risk_room_id') ?? '';
    this.seatId = localStorage.getItem('risk_seat_id') ?? '';

    if (!this.roomId) {
      this.router.navigate(['/juegos/risk']);
      return;
    }
    if (!this.seatId) {
      this.router.navigate(['/juegos/risk'], { queryParams: { room: this.roomId } });
      return;
    }

    this.game.attach(this.roomId, this.seatId);
    this.botDelay = this.game.botDelayMs;

    // La aplicación no usa zone.js: cada actualización asíncrona tiene que
    // marcar la vista a mano. Usamos markForCheck (no detectChanges) para que
    // Angular agrupe el repintado al final del ciclo; si no, una emisión
    // encadenada puede cambiar un valor ya comprobado (NG0100).
    this.subs.push(
      this.rooms.meta$.subscribe((meta) => {
        this.meta = meta;
        if (meta) {
          try {
            this.map = getMap(meta.mapId);
          } catch {
            this.map = null;
          }
        }
        this.cdr.markForCheck();
      }),
      this.rooms.seats$.subscribe((seats) => {
        this.seats = seats;
        this.cdr.markForCheck();
      }),
      this.rooms.chat$.subscribe((chat) => {
        const previous = this.chat;
        this.chat = chat;
        this.narrateNewChronicle(previous, chat);
        this.cdr.markForCheck();
      }),
      this.game.state$.subscribe((state) => {
        this.state = state;
        this.syncSelectionWithState();
        this.refreshMissions();
        this.cdr.markForCheck();
      }),
      this.game.derived$.subscribe((derived) => {
        this.derived = derived;
        this.cdr.markForCheck();
      }),
      this.game.advice$.subscribe((advice) => {
        this.advice = advice;
        this.cdr.markForCheck();
      }),
      this.game.hostSeatId$.subscribe((host) => {
        this.hostSeatId = host;
        this.cdr.markForCheck();
      }),
      this.game.thinking$.subscribe((thinking) => {
        this.thinking = thinking;
        this.cdr.markForCheck();
      }),
    );

    void this.rooms.markPresence(this.roomId, this.seatId);
  }

  @HostListener('window:beforeunload')
  onUnload(): void {
    if (this.roomId && this.seatId) {
      void this.rooms.updateSeat(this.roomId, this.seatId, { connected: false });
    }
  }

  ngOnDestroy(): void {
    if (this.deployFlushTimer) clearTimeout(this.deployFlushTimer);
    for (const sub of this.subs) sub.unsubscribe();
    this.game.detach();
    this.rooms.disconnect();
  }

  // ===== ESTADO DERIVADO =====

  get isOwner(): boolean {
    return this.seats.find((seat) => seat.id === this.seatId)?.isOwner ?? false;
  }

  get isHost(): boolean {
    return this.hostSeatId === this.seatId;
  }

  get inGame(): boolean {
    return this.meta?.status === 'playing' || this.meta?.status === 'finished';
  }

  get me(): PlayerState | undefined {
    return this.state ? playerById(this.state, this.seatId) : undefined;
  }

  get active(): PlayerState | undefined {
    return this.state ? currentPlayer(this.state) : undefined;
  }

  /**
   * Es mi turno Y sigo llevando yo mis ejércitos. Si he abandonado, el puesto
   * lo mueve la IA y no debo ver (ni poder usar) los controles.
   */
  get isMyTurn(): boolean {
    return (
      !!this.state && !!this.active && this.active.id === this.seatId && !this.handedToAi
    );
  }

  /** He abandonado: mi asiento sigue en la mesa pero lo juega la IA. */
  get handedToAi(): boolean {
    return this.me?.kind === 'bot';
  }

  get freeSeats(): number {
    return Math.max(0, (this.meta?.maxPlayers ?? 0) - this.seats.length);
  }

  get canStart(): boolean {
    return this.seats.length >= 2 && this.isOwner && this.meta?.status === 'lobby';
  }

  get inviteLink(): string {
    return `${window.location.origin}/juegos/risk?room=${this.roomId}`;
  }

  get phaseLabel(): string {
    switch (this.state?.phase) {
      case 'setup-claim':
        return 'Reparto: elegid territorios';
      case 'setup-deploy':
        return 'Reparto: colocad ejércitos';
      case 'reinforce':
        return 'Refuerzos';
      case 'attack':
        return 'Ataque';
      case 'fortify':
        return 'Reagrupación';
      case 'game-over':
        return 'Partida terminada';
      default:
        return '';
    }
  }

  get reinforcementDetail(): string {
    if (!this.state || !this.map || !this.me) return '';
    const breakdown = reinforcementBreakdown(this.state, this.map, this.me.id);
    const bonus = breakdown.continents.map((c) => `${c.name} +${c.bonus}`).join(', ');
    return bonus ? `${breakdown.base} base · ${bonus}` : `${breakdown.base} por territorios`;
  }

  get winner(): PlayerState | undefined {
    if (!this.state?.winnerId) return undefined;
    return playerById(this.state, this.state.winnerId);
  }

  /** Marcador ordenado, con el color y el nombre de cada jugador. */
  get scoreboard(): Array<{ player: PlayerState; territories: number; armies: number }> {
    if (!this.state) return [];
    const state = this.state;
    return standings(state)
      .map((entry) => ({
        player: playerById(state, entry.playerId)!,
        territories: entry.territories,
        armies: entry.armies,
      }))
      .filter((entry) => !!entry.player);
  }
  /**
   * A qué territorio se pegan los controles de la jugada.
   *
   * Al destino si ya lo has elegido, y si no al origen: siempre al último sitio
   * que has tocado, que es donde estás mirando.
   */
  get anchorTerritory(): TerritoryId | null {
    if (!this.isMyTurn || !this.state) return null;
    if (this.state.pendingOccupation) return this.state.pendingOccupation.to;
    return this.selectedTo ?? this.selectedFrom;
  }

  /**
   * Qué hacer ahora, en una línea, dentro del bloque de fase.
   *
   * Sólo cuando hace falta: en cuanto has elegido un territorio, el control ya
   * está pegado a él y esta frase sobra.
   */
  get phaseHint(): string {
    if (!this.isMyTurn || !this.state) return '';
    switch (this.state.phase) {
      case 'setup-claim':
        return 'Elige un territorio libre';
      case 'setup-deploy':
        return 'Refuerza un territorio tuyo';
      case 'reinforce':
        return this.reserveLeft > 0 ? 'Toca tus territorios · mantén pulsado para varias' : '';
      case 'attack':
        return this.selectedFrom ? '' : 'Elige desde dónde atacas (hacen falta 2 ejércitos)';
      case 'fortify':
        if (this.state.fortifiedThisTurn) return 'Ya has reagrupado este turno';
        return this.selectedFrom ? '' : 'Elige desde dónde mueves ejércitos';
      default:
        return '';
    }
  }

  /** Las últimas voces públicas, para el rastro de abajo a la izquierda. */
  get trailLines(): ChatEntry[] {
    return this.chatFeed.filter((entry) => !entry.to).slice(-3);
  }

  /** Quién mueve ahora, para marcarlo en el marcador. */
  get currentPlayerId(): string {
    return this.active?.id ?? '';
  }

  /** Frase de turno para la barra de arriba. */
  get turnLabel(): string {
    if (!this.active) return '';
    if (this.handedToAi && this.active.id === this.seatId) return 'La IA juega por ti';
    return this.isMyTurn ? 'Es tu turno' : `Turno de ${this.active.name}`;
  }

  /**
   * Mantener pulsado sólo coloca tropas en refuerzos y cuando te toca.
   *
   * Fuera de ahí, mantener el dedo sobre un territorio enseña su ficha en vez
   * de colocar. El tablero no sabe de fases, así que se decide aquí.
   */
  get repeatOnHold(): boolean {
    return this.isMyTurn && this.state?.phase === 'reinforce';
  }

  /** Panel abierto, si hay alguno. Sólo uno: dos taparían el mapa. */
  openPanel: PanelId | null = null;

  togglePanel(id: PanelId): void {
    this.openPanel = this.openPanel === id ? null : id;
  }

  /**
   * Al llegar tu turno se cierra el panel que estuviera abierto.
   *
   * Con el mapa tapado por el chat, el turno te llega y no te enteras.
   */
  private lastTurnWasMine = false;

  private closePanelOnMyTurn(): void {
    const mine = this.isMyTurn;
    if (mine && !this.lastTurnWasMine) this.openPanel = null;
    this.lastTurnWasMine = mine;
  }

  territoryCount(playerId: string): number {
    return this.state ? territoriesOf(this.state, playerId).length : 0;
  }

  // ===== SELECCIÓN EN EL TABLERO =====

  /**
   * Listas de territorios pulsables. Se recalculan cuando cambia el estado o la
   * selección y NO en cada ciclo de detección de cambios: si el template
   * recibiera un array nuevo cada vez, el tablero (OnPush) se marcaría sucio sin
   * parar y la vista no llegaría nunca a estabilizarse.
   */
  selectableTerritories: TerritoryId[] = [];
  targetTerritories: TerritoryId[] = [];

  private recomputeSelection(): void {
    this.closePanelOnMyTurn();
    this.selectableTerritories = this.computeSelectable();
    this.targetTerritories = this.computeTargets();
    // Tras cada ronda de combate el origen tiene menos ejércitos, así que el
    // número de dados elegido puede haberse quedado por encima del máximo.
    if (this.selectedFrom) {
      this.attackDice = Math.min(this.attackDice, this.maxDiceForSelection());
    }
  }

  private computeSelectable(): TerritoryId[] {
    if (!this.state || !this.map || !this.isMyTurn || !this.me) return [];
    const state = this.state;
    const map = this.map;

    switch (state.phase) {
      case 'setup-claim':
        return Object.keys(state.territories).filter((id) => state.territories[id].ownerId === null);
      case 'setup-deploy':
      case 'reinforce':
        return territoriesOf(state, this.me.id);
      case 'attack':
        return state.pendingOccupation ? [] : attackSources(state, map, this.me.id);
      case 'fortify':
        if (state.fortifiedThisTurn) return [];
        return territoriesOf(state, this.me.id).filter((id) => state.territories[id].armies > 1);
      default:
        return [];
    }
  }

  private computeTargets(): TerritoryId[] {
    if (!this.state || !this.map || !this.selectedFrom || !this.me) return [];
    const state = this.state;
    const map = this.map;
    if (state.phase === 'attack') {
      return attackTargets(state, map, this.selectedFrom, this.me.id).filter(
        () => state.territories[this.selectedFrom!].armies >= 2,
      );
    }
    if (state.phase === 'fortify') {
      return territoriesOf(state, this.me.id).filter(
        (id) => id !== this.selectedFrom && areConnected(state, map, this.selectedFrom!, id, this.me!.id),
      );
    }
    return [];
  }

  onTerritoryClick(id: TerritoryId): void {
    this.errorMessage = '';
    if (!this.state || !this.isMyTurn) return;
    this.applyTerritoryClick(id);
    this.recomputeSelection();
  }

  private applyTerritoryClick(id: TerritoryId): void {
    if (!this.state) return;
    const phase = this.state.phase;

    if (phase === 'setup-claim' || phase === 'setup-deploy') {
      void this.send({ type: 'claim', playerId: this.seatId, territoryId: id });
      return;
    }

    if (phase === 'reinforce') {
      if (!this.selectableTerritories.includes(id)) return;
      this.selectedFrom = id;
      this.deployAmount = Math.min(this.deployAmount, this.me?.reserve ?? 1) || 1;
      this.queueDeploy(id);
      return;
    }

    if (phase === 'attack') {
      if (this.state.pendingOccupation) return;
      if (this.selectedFrom && this.targetTerritories.includes(id)) {
        this.selectedTo = id;
        this.attackDice = this.maxDiceForSelection();
        return;
      }
      if (this.selectableTerritories.includes(id)) {
        this.selectedFrom = id;
        this.selectedTo = null;
        this.attackDice = this.maxDiceForSelection();
      }
      return;
    }

    if (phase === 'fortify') {
      if (this.selectedFrom && this.targetTerritories.includes(id)) {
        this.selectedTo = id;
        this.fortifyArmies = Math.max(1, this.maxFortify() );
        return;
      }
      if (this.selectableTerritories.includes(id)) {
        this.selectedFrom = id;
        this.selectedTo = null;
      }
    }
  }

  clearSelection(): void {
    this.selectedFrom = null;
    this.selectedTo = null;
    this.recomputeSelection();
  }

  private syncSelectionWithState(): void {
    if (!this.state) {
      this.recomputeSelection();
      return;
    }
    if (!this.isMyTurn) {
      this.clearSelection();
      return;
    }
    if (this.selectedFrom && !this.state.territories[this.selectedFrom]) this.selectedFrom = null;
    if (this.selectedTo && !this.state.territories[this.selectedTo]) this.selectedTo = null;
    // Tras colocar (o deshacer) la reserva cambia: el deslizador tiene que
    // seguirla o se queda enseñando una cantidad que ya no se puede poner.
    if (this.state.phase === 'reinforce') {
      const reserve = this.me?.reserve ?? 0;
      this.deployAmount = Math.max(1, Math.min(this.deployAmount, reserve || 1));
    }
    if (this.state.pendingOccupation) {
      const pending = this.state.pendingOccupation;
      const max = Math.max(1, this.state.territories[pending.from].armies - 1);
      const min = Math.min(pending.minArmies, max);
      this.occupyArmies = Math.min(Math.max(this.occupyArmies, min), max);
    }
    this.recomputeSelection();
  }

  /**
   * Reglas del ataque que se está apuntando: topes y terreno.
   *
   * En fase de ataque `selectedTo` es el objetivo; mientras no lo haya, se usan
   * las reglas de la mesa sin terreno, que es lo que hay que enseñar.
   */
  private selectionRules() {
    if (!this.state || !this.map || !this.selectedFrom) return null;
    const to = this.selectedTo ?? this.selectedFrom;
    return battleRulesFor(
      this.map,
      this.state.config,
      this.selectedFrom,
      to,
      this.state.territories[this.selectedFrom],
      this.state.territories[to],
    );
  }

  maxDiceForSelection(): number {
    if (!this.state || !this.selectedFrom) return 1;
    const rules = this.selectionRules();
    return Math.max(
      1,
      maxAttackDice(this.state.territories[this.selectedFrom].armies, rules?.attack ?? 3),
    );
  }

  /** ¿El ataque apuntado es un desembarco? (solo en modo avanzado). */
  isLandingSelected(): boolean {
    if (!this.state?.config.advancedTerrain || !this.map) return false;
    if (!this.selectedFrom || !this.selectedTo) return false;
    return approachOf(this.map, this.selectedFrom, this.selectedTo) === 'desembarco';
  }

  /** Ficha del terreno de un territorio, para enseñarla junto a la selección. */
  terrainOf(id: TerritoryId | null) {
    if (!this.state?.config.advancedTerrain || !this.map || !id) return null;
    const terrain = this.map.territories.find((t) => t.id === id)?.terrain;
    return terrain ? TERRAIN_META[terrain] : null;
  }

  /**
   * Narra la última crónica cuando llega una nueva.
   *
   * Solo la última: si se encolaran, la voz iría minutos por detrás del tablero
   * contando una batalla que ya terminó.
   */
  private narrateNewChronicle(previous: ChatEntry[], next: ChatEntry[]): void {
    if (!this.narrator.enabled || next.length === 0) return;
    if (next.length <= previous.length) return;
    const latest = next[next.length - 1];
    if (latest.authorId !== 'chronicle') return;
    void this.narrator.speak(latest.text, this.aiSettings);
  }

  toggleNarrator(): void {
    this.narrator.toggle();
  }

  /** ¿Esta mesa tiene crónica que narrar? */
  get byChronicle(): boolean {
    return !!this.map?.scenario;
  }

  get narratorVoices() {
    return TTS_VOICES;
  }

  /** ¿Se puede narrar? Hace falta clave de OpenRouter. */
  get canNarrate(): boolean {
    return this.aiSettings.provider === 'openrouter' && !!this.aiSettings.apiKey;
  }

  /** Modo avanzado activo en esta partida. */
  get advancedTerrain(): boolean {
    return !!this.state?.config.advancedTerrain;
  }

  /** Tropas especializadas activas en esta partida. */
  get advancedUnits(): boolean {
    return !!this.state?.config.advancedUnits;
  }

  /** ¿Esta mesa se gana por objetivos? */
  get byObjectives(): boolean {
    return this.state?.config.victory === 'objectives' && !!this.state.missions;
  }

  /**
   * Objetivos de la mesa, recalculados solo cuando cambia el estado.
   *
   * Igual que el cartel del tablero: si la plantilla llamara a una función que
   * devuelve objetos nuevos en cada ciclo, la vista quedaría siempre sucia.
   */
  missions: Array<{
    playerId: string;
    name: string;
    color: string;
    text: string;
    detail: string;
    done: boolean;
  }> = [];

  private refreshMissions(): void {
    if (!this.state || !this.map || this.state.config.victory !== 'objectives') {
      if (this.missions.length > 0) this.missions = [];
      return;
    }
    this.missions = this.state.players.map((player) => {
      const progress = missionProgress(this.state!, this.map!, player.id);
      return {
        playerId: player.id,
        name: player.name,
        color: player.color,
        text: progress.text,
        detail: progress.detail,
        done: progress.done,
      };
    });
  }

  /** Catálogo de tropas para la barra de refuerzos. */
  readonly troops = UNIT_KINDS.map((kind) => UNIT_META[kind]);

  /** ¿El ataque apuntado llega por aire? */
  isAirSelected(): boolean {
    if (!this.advancedUnits || !this.map || !this.selectedFrom || !this.selectedTo) return false;
    const origin = this.state?.territories[this.selectedFrom];
    return approachOf(this.map, this.selectedFrom, this.selectedTo, origin) === 'aereo';
  }

  /** ¿El origen aporta blindados a este ataque? */
  isArmouredSelected(): boolean {
    if (!this.advancedUnits || !this.selectedFrom || !this.selectedTo) return false;
    const rules = this.selectionRules();
    return (rules?.attackBonus?.length ?? 0) > 0;
  }

  /** ¿Se puede ascender una ficha del territorio elegido a esta tropa? */
  canUpgrade(kind: (typeof UNIT_KINDS)[number]): boolean {
    if (!this.advancedUnits || !this.state || !this.selectedFrom || !this.me) return false;
    if (this.state.phase !== 'reinforce') return false;
    const territory = this.state.territories[this.selectedFrom];
    if (!territory || territory.ownerId !== this.seatId) return false;
    if (infantryOf(territory) < 1) return false;
    // Repetir la misma tropa en el mismo sitio no aporta nada: no se acumulan.
    if (hasUnit(territory, kind)) return false;
    return this.me.reserve >= UNIT_META[kind].cost;
  }

  async upgrade(kind: (typeof UNIT_KINDS)[number]): Promise<void> {
    if (!this.selectedFrom || !this.canUpgrade(kind)) return;
    await this.send({ type: 'upgrade', playerId: this.seatId, territoryId: this.selectedFrom, unit: kind });
  }

  maxFortify(): number {
    if (!this.state || !this.selectedFrom) return 1;
    return Math.max(1, this.state.territories[this.selectedFrom].armies - 1);
  }

  selectionOdds(): number | null {
    if (!this.state || !this.selectedFrom || !this.selectedTo) return null;
    return conquestOdds(
      this.state.territories[this.selectedFrom].armies,
      this.state.territories[this.selectedTo].armies,
      this.selectionRules() ?? undefined,
    );
  }

  territoryName(id: TerritoryId | null | undefined): string {
    if (!id || !this.map) return '';
    return this.map.territories.find((t) => t.id === id)?.name ?? id;
  }

  // ===== ACCIONES =====

  private async send(action: Parameters<RiskGameService['play']>[0]): Promise<void> {
    try {
      await this.game.play(action);
    } catch (error) {
      this.errorMessage = (error as Error).message;
    }
  }

  /** Cuántas colocaciones se pueden deshacer. */
  get placedCount(): number {
    return this.state?.placedThisTurn?.length ?? 0;
  }

  /** Cuántos ejércitos suman esas colocaciones. */
  get placedTotal(): number {
    return (this.state?.placedThisTurn ?? []).reduce((sum, entry) => sum + entry.armies, 0);
  }

  async undoDeploy(all = false): Promise<void> {
    await this.flushDeploy();
    if (this.placedCount === 0) return;
    await this.send({ type: 'undo-deploy', playerId: this.seatId, all });
  }

  /**
   * Cuánto se espera desde el último toque antes de mandar la colocación.
   *
   * Los toques se acumulan y salen en una sola acción. Uno por toque serían
   * tantas escrituras en Firebase como toques, y otras tantas líneas de
   * registro: online iría a trompicones y el historial quedaría ilegible.
   */
  readonly DEPLOY_FLUSH_MS = 350;

  private pendingDeploy: { territoryId: TerritoryId; armies: number } | null = null;
  private deployFlushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Lo que queda por colocar CONTANDO lo que aún no ha salido.
   *
   * La pantalla tiene que responder al dedo aunque la escritura tarde, así que
   * el contador baja en el toque y no cuando la acción llega a la sala.
   */
  get reserveLeft(): number {
    return Math.max(0, (this.me?.reserve ?? 0) - (this.pendingDeploy?.armies ?? 0));
  }

  private queueDeploy(territoryId: TerritoryId): void {
    if (this.reserveLeft <= 0) return;
    // Cambiar de destino cierra lo anterior: una acción por territorio.
    if (this.pendingDeploy && this.pendingDeploy.territoryId !== territoryId) {
      void this.flushDeploy();
    }
    this.pendingDeploy = {
      territoryId,
      armies: (this.pendingDeploy?.armies ?? 0) + 1,
    };
    if (this.deployFlushTimer) clearTimeout(this.deployFlushTimer);
    this.deployFlushTimer = setTimeout(() => void this.flushDeploy(), this.DEPLOY_FLUSH_MS);
    this.cdr.markForCheck();
  }

  /**
   * Manda de golpe todo lo acumulado.
   *
   * Se llama sola al dejar de tocar, y a mano antes de cualquier cosa que
   * dependa de la reserva: deshacer, terminar la fase o colocar con el
   * deslizador.
   */
  async flushDeploy(): Promise<void> {
    if (this.deployFlushTimer) clearTimeout(this.deployFlushTimer);
    this.deployFlushTimer = null;
    const pending = this.pendingDeploy;
    if (!pending) return;
    try {
      await this.send({
        type: 'deploy',
        playerId: this.seatId,
        territoryId: pending.territoryId,
        armies: pending.armies,
      });
    } finally {
      // Se suelta pase lo que pase: si la acción se rechaza, `send` ya deja el
      // aviso en pantalla y el contador tiene que volver a la verdad.
      this.pendingDeploy = null;
      this.cdr.markForCheck();
    }
  }

  async deploy(all = false): Promise<void> {
    // Lo tocado va primero, o se contaría dos veces la misma reserva.
    await this.flushDeploy();
    if (!this.selectedFrom || !this.me) return;
    const armies = all ? this.me.reserve : Math.min(this.deployAmount, this.me.reserve);
    if (armies <= 0) return;
    await this.send({ type: 'deploy', playerId: this.seatId, territoryId: this.selectedFrom, armies });
  }

  async attack(): Promise<void> {
    if (!this.selectedFrom || !this.selectedTo) return;
    await this.send({
      type: 'attack',
      playerId: this.seatId,
      from: this.selectedFrom,
      to: this.selectedTo,
      dice: this.attackDice,
    });
  }

  async occupy(): Promise<void> {
    await this.send({ type: 'occupy', playerId: this.seatId, armies: this.occupyArmies });
  }

  async fortify(): Promise<void> {
    if (!this.selectedFrom || !this.selectedTo) return;
    const action = {
      type: 'fortify' as const,
      playerId: this.seatId,
      from: this.selectedFrom,
      to: this.selectedTo,
      armies: this.fortifyArmies,
    };
    // Limpiamos antes de enviar: la acción provoca un repintado inmediato y
    // cambiar la selección después dejaría la vista descuadrada.
    this.clearSelection();
    await this.send(action);
  }

  async endPhase(): Promise<void> {
    await this.flushDeploy();
    this.clearSelection();
    await this.send({ type: 'end-phase', playerId: this.seatId });
  }

  async surrender(): Promise<void> {
    this.clearSelection();
    await this.send({ type: 'surrender', playerId: this.seatId });
  }

  canEndPhase(): boolean {
    if (!this.state || !this.isMyTurn) return false;
    return legalActionTypes(this.state, this.seatId).includes('end-phase');
  }

  // ===== CARTAS =====

  get myCards(): Card[] {
    return this.me?.cards ?? [];
  }

  private cardViewsCache: CardView[] = [];
  private cardViewsFrom: readonly Card[] | null = null;

  /**
   * La mano ya en palabras, para que la esquina de cartas no sepa reglas.
   *
   * Memorizada contra la identidad de la mano: un getter que devolviera un
   * array nuevo en cada ciclo de detección de cambios obligaría a `*ngFor` a
   * rehacer las cartas constantemente.
   */
  get cardViews(): CardView[] {
    const cards = this.myCards;
    if (this.cardViewsFrom === cards) return this.cardViewsCache;
    this.cardViewsFrom = cards;
    this.cardViewsCache = cards.map((card) => ({
      id: card.id,
      icon: this.cardIcon[card.symbol],
      label: this.cardLabel[card.symbol],
      territory: this.territoryName(card.territoryId),
    }));
    return this.cardViewsCache;
  }

  /** Se puede canjear ahora mismo, no sólo «el trío es válido». */
  get canTradeNow(): boolean {
    return this.selectedCardsAreValid && this.state?.phase === 'reinforce' && this.isMyTurn;
  }

  pickCard(id: string): void {
    const card = this.myCards.find((c) => c.id === id);
    if (card) this.toggleCard(card);
  }

  toggleCard(card: Card): void {
    const index = this.selectedCards.indexOf(card.id);
    if (index >= 0) {
      this.selectedCards.splice(index, 1);
      return;
    }
    if (this.selectedCards.length >= 3) this.selectedCards.shift();
    this.selectedCards.push(card.id);
  }

  get selectedCardsAreValid(): boolean {
    if (this.selectedCards.length !== 3) return false;
    const cards = this.myCards.filter((card) => this.selectedCards.includes(card.id));
    return cards.length === 3 && isValidSet(cards);
  }

  get mustTradeNow(): boolean {
    return !!this.me && mustTrade(this.me);
  }

  async tradeCards(): Promise<void> {
    if (!this.selectedCardsAreValid) return;
    const [a, b, c] = this.selectedCards;
    await this.send({ type: 'trade', playerId: this.seatId, cardIds: [a, b, c] });
    this.selectedCards = [];
  }

  // ===== SALA DE ESPERA =====

  async addBot(): Promise<void> {
    if (!this.meta || this.freeSeats <= 0) return;
    const usedColors = new Set(this.seats.map((seat) => seat.color));
    const color = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[this.seats.length % PLAYER_COLORS.length];
    const info = BOT_PROFILES[this.newBotProfile];
    const name = `${info.label} ${this.seats.filter((s) => s.kind === 'bot').length + 1}`;
    await this.rooms.addBotSeat(this.roomId, { name, botProfile: this.newBotProfile, color });
  }

  /** Rellena de golpe todos los huecos que queden. */
  async fillWithBots(): Promise<void> {
    const missing = this.freeSeats;
    for (let i = 0; i < missing; i++) {
      this.newBotProfile = BOT_PROFILE_IDS[i % BOT_PROFILE_IDS.length];
      await this.addBot();
    }
  }

  async removeSeat(seat: RoomSeat): Promise<void> {
    if (!this.isOwner || seat.id === this.seatId) return;
    await this.rooms.removeSeat(this.roomId, seat.id);
  }

  /**
   * Reparte colores, congela la alineación y arranca.
   *
   * Congelar la alineación es lo que hace la partida reproducible: a partir de
   * aquí el estado inicial ya no depende de los asientos, que pueden cambiar
   * (renombres, desconexiones, colores) sin descuadrar el tablero de nadie.
   */
  async startGame(): Promise<void> {
    if (!this.canStart) return;
    // Empezar toca la base, y ahí puede fallar cualquier cosa: permisos, red,
    // un dato que no le gusta. Antes el error se perdía y el botón se quedaba
    // sin hacer nada, que es la peor manera de fallar.
    this.errorMessage = '';
    try {
      await this.assignColors();
      const roster = seatsToRoster(
        this.seats.map((seat, index) => ({
          ...seat,
          order: index,
          color: PLAYER_COLORS[index % PLAYER_COLORS.length],
        })),
      );
      await this.rooms.updateMeta(this.roomId, { roster, status: 'playing' });
      await this.rooms.sendChat(this.roomId, {
        authorId: 'system',
        author: 'Sala',
        kind: 'system',
        text: '¡Que empiece la conquista! Suerte con los dados.',
      });
    } catch (error) {
      this.errorMessage = `No se ha podido empezar la partida: ${
        (error as Error)?.message ?? 'error desconocido'
      }`;
      this.cdr.markForCheck();
    }
  }

  /** Da a cada asiento un color distinto antes de empezar. */
  private async assignColors(): Promise<void> {
    for (const [index, seat] of this.seats.entries()) {
      await this.rooms.updateSeat(this.roomId, seat.id, {
        color: PLAYER_COLORS[index % PLAYER_COLORS.length],
        order: index,
      });
    }
  }

  async pauseGame(): Promise<void> {
    await this.rooms.setStatus(this.roomId, 'paused');
  }

  async resumeGame(): Promise<void> {
    await this.rooms.setStatus(this.roomId, 'playing');
  }

  copyInvite(): void {
    navigator.clipboard?.writeText(this.inviteLink);
    this.copied = true;
    setTimeout(() => {
      this.copied = false;
      this.cdr.detectChanges();
    }, 1800);
  }

  leave(): void {
    void this.rooms.updateSeat(this.roomId, this.seatId, { connected: false });
    this.router.navigate(['/juegos/risk']);
  }

  // ===== CHAT =====

  private feedCache: ChatEntry[] = [];
  private feedFromChat: ChatEntry[] | null = null;
  private feedFromAdvice: ChatEntry[] | null = null;

  /**
   * Chat y consejos en una sola lista ordenada por hora.
   *
   * Memorizada contra la identidad de las dos listas de origen. Sin esto, cada
   * consulta copia y ordena hasta ciento veinte mensajes, y las fichas la
   * consultan una vez por jugador para contar los no leídos: seis ordenaciones
   * por ciclo de detección de cambios. Se notaba de verdad —el test de bots
   * jugando solos pasó de correr a atascarse.
   */
  get chatFeed(): ChatEntry[] {
    if (this.feedFromChat === this.chat && this.feedFromAdvice === this.advice) {
      return this.feedCache;
    }
    this.feedFromChat = this.chat;
    this.feedFromAdvice = this.advice;
    this.feedCache = [...this.chat, ...this.advice].sort((a, b) => a.ts - b.ts).slice(-120);
    return this.feedCache;
  }

  /**
   * Hilo abierto en la lista de jugadores, o ninguno.
   *
   * `CANAL_GENERAL` es el de todos; si no, el id del jugador con quien hablas.
   */
  openThread: string | null = null;
  /** Hasta cuándo se ha leído cada hilo, para el aviso de sin leer. */
  private seenAt: Record<string, number> = {};

  /**
   * A qué conversación pertenece un mensaje.
   *
   * Un privado pertenece al hilo del OTRO, sea yo quien escribe o quien recibe:
   * una conversación es una sola cosa vista desde los dos lados.
   */
  private threadOf(entry: ChatEntry): string {
    if (entry.kind === 'advisor') return HILO_ESTRATEGA;
    if (!entry.to) return CANAL_GENERAL;
    return entry.authorId === this.seatId ? entry.to : entry.authorId;
  }

  /** Un privado sólo se enseña a sus dos extremos. */
  private visibleToMe(entry: ChatEntry): boolean {
    if (!entry.to) return true;
    return entry.to === this.seatId || entry.authorId === this.seatId;
  }

  get threadLines(): ChatLine[] {
    const thread = this.openThread;
    if (!thread) return [];
    return this.chatFeed
      .filter((entry) => this.visibleToMe(entry) && this.threadOf(entry) === thread)
      .slice(-80)
      .map((entry) => ({
        key: entry.key,
        author: entry.author,
        color: this.colorOf(entry.authorId),
        text: entry.text,
        mine: entry.authorId === this.seatId,
        fromLlm: entry.origin === 'llm',
      }));
  }

  /**
   * Los no leídos de todos los hilos, en una sola pasada.
   *
   * Una pasada y no una por ficha: contar por separado obliga a recorrer la
   * conversación entera tantas veces como jugadores haya.
   */
  private unreadByThread(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of this.chatFeed) {
      if (!this.visibleToMe(entry)) continue;
      if (entry.authorId === this.seatId) continue;
      const thread = this.threadOf(entry);
      if (thread === this.openThread) continue;
      if (entry.ts <= (this.seenAt[thread] ?? 0)) continue;
      counts[thread] = (counts[thread] ?? 0) + 1;
    }
    return counts;
  }

  get generalUnread(): number {
    return this.unreadByThread()[CANAL_GENERAL] ?? 0;
  }

  /**
   * Las fichas: marcador y lista de conversaciones a la vez.
   *
   * El estratega va como una ficha más, con su botón en vez de campo de texto,
   * porque analiza tu posición y no conversa. Antes vivía en un botón dentro
   * del panel de chat; al desaparecer ese panel necesitaba puerta.
   */
  get rosterRows(): RosterRow[] {
    const total = this.scoreboard.reduce((sum, entry) => sum + entry.armies, 0) || 1;
    const unread = this.unreadByThread();
    const caras = this.portraitAssignment();
    const rows: RosterRow[] = this.scoreboard.map((entry, index) => ({
      id: entry.player.id,
      name: entry.player.name,
      color: entry.player.color,
      portrait: caras.get(entry.player.id) ?? COMMANDERS[index % COMMANDERS.length]!.portrait,
      territories: entry.territories,
      armies: entry.armies,
      eliminated: entry.player.eliminated,
      strength: entry.armies / total,
      unread: unread[entry.player.id] ?? 0,
    }));
    if (this.canNarrate) {
      rows.push({
        id: HILO_ESTRATEGA,
        name: 'Estratega',
        color: '#8b9c93',
        glyph: GLIFO_ESTRATEGA,
        territories: 0,
        armies: 0,
        eliminated: false,
        strength: 0,
        unread: unread[HILO_ESTRATEGA] ?? 0,
        askLabel: '🧠 Pedir consejo',
      });
    }
    return rows;
  }

  /**
   * Si estamos esperando a que el bot conteste.
   *
   * Se deduce de la conversación: el último que ha hablado soy yo y enfrente
   * hay una máquina. Sin este aviso, el hueco entre tu mensaje y su respuesta
   * parece que se ha perdido el mensaje.
   */
  get threadWaiting(): boolean {
    const thread = this.openThread;
    if (!thread || thread === CANAL_GENERAL || thread === HILO_ESTRATEGA) return false;
    if (this.seats.find((seat) => seat.id === thread)?.kind !== 'bot') return false;
    const lines = this.threadLines;
    return lines.length > 0 && !!lines[lines.length - 1]?.mine;
  }

  // ===== COMANDANTES =====

  readonly commanders = COMMANDERS;

  /** El retrato de un perfil de bot, para verle la cara antes de sentarlo. */
  botFace(profile: BotProfile): string {
    return botPortrait(profile);
  }

  /**
   * Reparto de comandantes: los elegidos mandan, el resto coge de los que
   * sobran.
   *
   * Se reparte todo de una vez y no asiento por asiento, porque si no un
   * comandante elegido y uno repartido pueden salir iguales, y dos jugadores
   * con la misma cara rompen justo lo que la cara resuelve: saber de quién es
   * cada ficha de un vistazo.
   *
   * Los bots no entran en el reparto: su retrato sale de su perfil, y por eso
   * el agresivo tiene cara de agresivo.
   */
  private portraitAssignment(): Map<string, string> {
    const humanos = this.seats.filter((seat) => seat.kind !== 'bot');
    const elegidos = new Set(
      humanos.map((seat) => seat.avatar).filter((id): id is string => !!commanderById(id)),
    );
    const libres = COMMANDERS.filter((commander) => !elegidos.has(commander.id));
    const reparto = new Map<string, string>();
    let siguiente = 0;
    for (const seat of this.seats) {
      if (seat.kind === 'bot') {
        reparto.set(seat.id, botPortrait(seat.botProfile));
        continue;
      }
      const elegido = commanderById(seat.avatar);
      const cara = elegido ?? libres[siguiente++ % Math.max(1, libres.length)] ?? COMMANDERS[0]!;
      reparto.set(seat.id, cara.portrait);
    }
    return reparto;
  }

  /** El comandante que llevo, elegido o repartido. */
  get myCommander(): Commander | undefined {
    const retrato = this.portraitAssignment().get(this.seatId);
    return COMMANDERS.find((commander) => commander.portrait === retrato);
  }

  /** Comandantes que ya lleva otra persona. */
  commanderTaken(id: string): boolean {
    return this.seats.some(
      (seat) => seat.id !== this.seatId && seat.kind !== 'bot' && seat.avatar === id,
    );
  }

  async chooseCommander(id: string): Promise<void> {
    if (this.commanderTaken(id)) return;
    await this.rooms.updateSeat(this.roomId, this.seatId, { avatar: id });
  }

  /** El retrato de un asiento en la sala de espera. */
  portraitOfSeat(seat: RoomSeat): string {
    return this.portraitAssignment().get(seat.id) ?? COMMANDERS[0]!.portrait;
  }

  onThreadChange(id: string | null): void {
    const now = Date.now();
    if (this.openThread) this.seenAt[this.openThread] = now;
    this.openThread = id;
    if (id) this.seenAt[id] = now;
  }

  async sendToThread(text: string): Promise<void> {
    if (this.openThread === HILO_ESTRATEGA) {
      await this.askAdvisor();
      return;
    }
    const clean = text.trim();
    if (!clean) return;
    await this.rooms.sendChat(this.roomId, {
      authorId: this.seatId,
      author: this.seats.find((seat) => seat.id === this.seatId)?.name ?? 'Jugador',
      kind: 'player',
      text: clean,
      // El canal general va sin destinatario, que es lo que lo hace general.
      to: this.openThread === CANAL_GENERAL ? undefined : (this.openThread ?? undefined),
    });
  }

  async askAdvisor(): Promise<void> {
    this.onThreadChange(HILO_ESTRATEGA);
    await this.game.askAdvisor();
  }

  colorOf(playerId: string): string {
    return (
      this.state?.players.find((p) => p.id === playerId)?.color ??
      this.seats.find((seat) => seat.id === playerId)?.color ??
      '#8b9c93'
    );
  }

  // ===== CONFIGURACIÓN DE IA =====

  get modelOptions() {
    return FREE_MODELS[this.aiSettings.provider] ?? [];
  }

  onProviderChange(): void {
    const options = this.modelOptions;
    if (options.length > 0) this.aiSettings.model = options[0].id;
  }

  setBotDelay(ms: number): void {
    this.botDelay = Number(ms);
    this.game.setBotDelay(this.botDelay);
  }

  saveAi(): void {
    saveAiSettings(this.aiSettings);
    this.game.updateAiSettings(this.aiSettings);
  }

  trackChat = (_: number, entry: ChatEntry) => entry.key;
  trackSeat = (_: number, seat: RoomSeat) => seat.id;
  trackEvent = (_: number, event: { at: number; text: string }) => `${event.at}-${event.text}`;
}
