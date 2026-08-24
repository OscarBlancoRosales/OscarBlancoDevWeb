import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TerminalLayout } from '../../../../shared/terminal-layout/terminal-layout';
import { RiskBoard } from '../risk-board/risk-board';
import {
  ChatEntry,
  RiskRoomService,
  RoomMeta,
  RoomSeat,
  localSeatToken,
} from '../../services/risk-room.service';
import { BOT_SPEEDS, RiskGameService } from '../../services/risk-game.service';
import { DerivedGame, seatsToRoster } from '../../services/risk-sync';
import { getMap } from '../../engine/maps/map-registry';
import {
  Card,
  GameMap,
  GameState,
  PlayerState,
  TerritoryId,
} from '../../engine/types';
import {
  PLAYER_COLORS,
  currentPlayer,
  legalActionTypes,
  mustTrade,
  playerById,
} from '../../engine/engine';
import {
  areConnected,
  attackSources,
  attackTargets,
  reinforcementBreakdown,
  territoriesOf,
} from '../../engine/rules';
import { conquestOdds, diceCapsOf, maxAttackDice } from '../../engine/combat';
import { CARD_ICON, CARD_LABEL, isValidSet } from '../../engine/cards';
import { BOT_PROFILES, BOT_PROFILE_IDS, standings } from '../../engine/ai/bot-brain';
import { BotProfile } from '../../engine/types';
import {
  AiSettings,
  FREE_MODELS,
  PROVIDER_LABELS,
  PROVIDER_SIGNUP,
  AiProvider,
  loadAiSettings,
  saveAiSettings,
} from '../../engine/ai/ai-client';

type Panel = 'chat' | 'eventos' | 'cartas' | 'ia';

/**
 * La mesa: sala de espera y partida en el mismo sitio.
 * Aquí se junta todo: tablero, reglas, chat, IA y los controles del turno.
 */
@Component({
  selector: 'app-risk-room',
  imports: [CommonModule, FormsModule, TerminalLayout, RiskBoard],
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
  chatDraft = '';
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
        this.chat = chat;
        this.cdr.markForCheck();
      }),
      this.game.state$.subscribe((state) => {
        this.state = state;
        this.syncSelectionWithState();
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
    this.selectableTerritories = this.computeSelectable();
    this.targetTerritories = this.computeTargets();
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
        (id) => state.territories[this.selectedFrom!].armies >= 2,
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
    if (this.state.pendingOccupation) {
      const pending = this.state.pendingOccupation;
      const max = Math.max(1, this.state.territories[pending.from].armies - 1);
      const min = Math.min(pending.minArmies, max);
      this.occupyArmies = Math.min(Math.max(this.occupyArmies, min), max);
    }
    this.recomputeSelection();
  }

  maxDiceForSelection(): number {
    if (!this.state || !this.selectedFrom) return 1;
    return Math.max(
      1,
      maxAttackDice(
        this.state.territories[this.selectedFrom].armies,
        diceCapsOf(this.state.config).attack,
      ),
    );
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
      diceCapsOf(this.state.config),
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

  async deploy(all = false): Promise<void> {
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

  get chatFeed(): ChatEntry[] {
    return [...this.chat, ...this.advice].sort((a, b) => a.ts - b.ts).slice(-120);
  }

  async sendChat(): Promise<void> {
    const text = this.chatDraft.trim();
    if (!text) return;
    this.chatDraft = '';
    await this.rooms.sendChat(this.roomId, {
      authorId: this.seatId,
      author: this.seats.find((seat) => seat.id === this.seatId)?.name ?? 'Jugador',
      kind: 'player',
      text,
    });
  }

  async askAdvisor(): Promise<void> {
    this.panel = 'chat';
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
