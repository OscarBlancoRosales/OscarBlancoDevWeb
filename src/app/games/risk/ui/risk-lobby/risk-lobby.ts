import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TerminalLayout } from '../../../../shared/terminal-layout/terminal-layout';
import { FirebaseAuthService } from '../../../../firebase-auth.service';
import { RISK_MAPS } from '../../engine/maps/map-registry';
import { DEFAULT_CONFIG, PLAYER_COLORS, createGame } from '../../engine/engine';
import { GameMap, GameState } from '../../engine/types';
import { RiskBoard } from '../risk-board/risk-board';
import { TERRAINS, TERRAIN_META } from '../../engine/terrain';
import { UNIT_KINDS, UNIT_META } from '../../engine/units';
import {
  RiskRoomService,
  RoomMeta,
  RoomSummary,
  localSeatToken,
} from '../../services/risk-room.service';

/**
 * Puerta de entrada al RISK.
 *
 * Tres caminos, igual que en el Scrum Poker:
 *  - administrador: crea sala y elige mapa, jugadores y reglas;
 *  - invitado: llega con un enlace y solo pone su nombre;
 *  - vuelta a una partida guardada: recupera su asiento tal y como lo dejó.
 */
@Component({
  selector: 'app-risk-lobby',
  imports: [CommonModule, FormsModule, TerminalLayout, RiskBoard],
  templateUrl: './risk-lobby.html',
  styleUrl: './risk-lobby.css',
})
export class RiskLobby implements OnInit {
  readonly maps: GameMap[] = RISK_MAPS;

  isAdmin = false;
  invitedRoomId = '';
  invitedRoom: RoomMeta | null = null;
  invitedError = '';

  // Formulario de creación
  roomName = '';
  mapId = RISK_MAPS[0].id;
  maxPlayers = 4;
  autoClaim = true;
  tradeProgression: 'classic' | 'fixed' = 'classic';
  advancedTerrain = false;
  advancedUnits = false;

  /** Fichas de los terrenos, para la leyenda del modo avanzado. */
  readonly terrains = TERRAINS.map((terrain) => TERRAIN_META[terrain]);
  /** Fichas de las tropas, para la leyenda del modo avanzado. */
  readonly troops = UNIT_KINDS.map((kind) => UNIT_META[kind]);

  // Entrada del jugador
  playerName = '';

  previewState: GameState | null = null;

  savedRooms: RoomSummary[] = [];
  loadingRooms = false;
  busy = false;
  error = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private rooms: RiskRoomService,
    private auth: FirebaseAuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  /**
   * La aplicación corre sin zone.js, así que cualquier cambio que venga de una
   * promesa hay que pedirlo a mano; si no, la vista se queda congelada.
   */
  private refreshView(): void {
    this.cdr.detectChanges();
  }

  async ngOnInit(): Promise<void> {
    this.isAdmin = !!localStorage.getItem('auth_token');
    this.playerName = localStorage.getItem('risk_player_name') ?? '';
    this.roomName = this.isAdmin ? `Partida de ${this.ownerName()}` : '';

    const roomParam = this.route.snapshot.queryParamMap.get('room');
    if (roomParam) {
      this.invitedRoomId = roomParam;
      const meta = await this.rooms.fetchMeta(roomParam);
      if (!meta) {
        this.invitedError = 'Esa sala ya no existe. Pide un enlace nuevo.';
      } else {
        this.invitedRoom = meta;
      }
      this.refreshView();
      return;
    }

    this.refreshPreview();
    await this.loadSavedRooms();
  }

  get selectedMap(): GameMap {
    return this.maps.find((map) => map.id === this.mapId) ?? this.maps[0];
  }

  get maxPlayersOptions(): number[] {
    const cap = this.selectedMap.maxPlayers;
    return Array.from({ length: cap - 1 }, (_, i) => i + 2);
  }

  selectMap(map: GameMap): void {
    this.mapId = map.id;
    if (this.maxPlayers > map.maxPlayers) this.maxPlayers = map.maxPlayers;
    this.refreshPreview();
  }

  /**
   * Partida de mentira solo para la vista previa: reparte el mapa entre tantos
   * jugadores como vaya a tener la mesa, para que se vea cómo queda repartido.
   */
  refreshPreview(): void {
    const map = this.selectedMap;
    const count = Math.min(this.maxPlayers, map.maxPlayers);
    try {
      this.previewState = createGame({
        map,
        seed: 20260824,
        players: Array.from({ length: count }, (_, i) => ({
          id: `preview-${i}`,
          name: `Jugador ${i + 1}`,
          kind: 'bot' as const,
        })),
      });
    } catch {
      this.previewState = null;
    }
  }

  ownerUid(): string {
    return this.auth.currentUser?.uid ?? localStorage.getItem('user_name') ?? 'admin';
  }

  ownerName(): string {
    const email = this.auth.currentUser?.email ?? localStorage.getItem('user_name') ?? 'Anfitrión';
    return email.split('@')[0];
  }

  async loadSavedRooms(): Promise<void> {
    this.loadingRooms = true;
    // Las locales están al instante; las de la nube pueden tardar o no llegar.
    this.savedRooms = this.rooms.listLocalRooms();
    try {
      if (this.isAdmin) {
        const remote = await this.rooms.listRoomsForOwner(this.ownerUid());
        this.savedRooms = [...this.rooms.listLocalRooms(), ...remote].sort(
          (a, b) => b.meta.updatedAt - a.meta.updatedAt,
        );
      }
    } catch {
      // Nos quedamos con las locales.
    } finally {
      this.loadingRooms = false;
      this.refreshView();
    }
  }

  /**
   * Crea la sala, se sienta como anfitrión y entra a la mesa.
   * `local` crea una partida que vive solo en este navegador: no necesita
   * cuenta, ni red, ni que Firebase esté configurado.
   */
  async createRoom(local = false): Promise<void> {
    if (this.busy) return;
    const name = this.playerName.trim() || this.ownerName();
    if (name.length < 2) {
      this.error = 'Escribe un nombre de jugador de al menos 2 letras.';
      return;
    }

    this.busy = true;
    this.error = '';
    try {
      const meta = await this.rooms.createRoom({
        name: this.roomName.trim() || `Partida de ${this.ownerName()}`,
        mapId: this.mapId,
        maxPlayers: this.maxPlayers,
        ownerUid: this.ownerUid(),
        ownerName: this.ownerName(),
        local,
        config: {
          ...DEFAULT_CONFIG,
          autoClaim: this.autoClaim,
          tradeProgression: this.tradeProgression,
          advancedTerrain: this.advancedTerrain,
          advancedUnits: this.advancedUnits,
        },
      });

      this.rooms.listenToRoom(meta.id);
      const seatId = await this.rooms.claimSeat(meta.id, {
        name,
        seatToken: this.ownerUid(),
        color: PLAYER_COLORS[0],
        isOwner: true,
      });

      this.remember(name, meta.id, seatId);
      await this.router.navigate(['/juegos/risk/mesa'], { queryParams: { room: meta.id } });
    } catch (error) {
      this.error = `No se ha podido crear la sala: ${(error as Error).message}`;
    } finally {
      this.busy = false;
      this.refreshView();
    }
  }

  /** Entra en una sala existente por invitación. */
  async joinRoom(): Promise<void> {
    if (this.busy || !this.invitedRoom) return;
    const name = this.playerName.trim();
    if (name.length < 2) {
      this.error = 'Escribe un nombre de al menos 2 letras.';
      return;
    }

    this.busy = true;
    this.error = '';
    try {
      const roomId = this.invitedRoom.id;
      this.rooms.listenToRoom(roomId);
      // Damos un instante a que lleguen los asientos: así, si ya teníamos uno,
      // lo recuperamos en vez de crear otro.
      await new Promise((resolve) => setTimeout(resolve, 350));
      const seatId = await this.rooms.claimSeat(roomId, {
        name,
        seatToken: this.seatToken(),
        color: PLAYER_COLORS[0],
      });
      this.remember(name, roomId, seatId);
      await this.router.navigate(['/juegos/risk/mesa'], { queryParams: { room: roomId } });
    } catch (error) {
      this.error = `No se ha podido entrar: ${(error as Error).message}`;
    } finally {
      this.busy = false;
      this.refreshView();
    }
  }

  /** Vuelve a una partida guardada por el anfitrión. */
  async resume(summary: RoomSummary): Promise<void> {
    const name = this.playerName.trim() || this.ownerName();
    if (summary.meta.local) {
      this.rooms.listenToRoom(summary.meta.id);
      const seatId = await this.rooms.claimSeat(summary.meta.id, {
        name,
        seatToken: this.ownerUid(),
        color: PLAYER_COLORS[0],
        isOwner: true,
      });
      this.remember(name, summary.meta.id, seatId);
      await this.router.navigate(['/juegos/risk/mesa'], { queryParams: { room: summary.meta.id } });
      return;
    }
    this.rooms.listenToRoom(summary.meta.id);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const seatId = await this.rooms.claimSeat(summary.meta.id, {
      name,
      seatToken: this.ownerUid(),
      color: PLAYER_COLORS[0],
      isOwner: true,
    });
    this.remember(name, summary.meta.id, seatId);
    await this.router.navigate(['/juegos/risk/mesa'], { queryParams: { room: summary.meta.id } });
  }

  async deleteRoom(summary: RoomSummary, event: Event): Promise<void> {
    event.stopPropagation();
    await this.rooms.deleteRoom(summary.meta.id);
    await this.loadSavedRooms();
    this.refreshView();
  }

  goToGames(): void {
    this.router.navigate(['/juegos']);
  }

  goToLogin(): void {
    this.router.navigate(['/auth'], { queryParams: { next: '/juegos/risk' } });
  }

  statusLabel(meta: RoomMeta): string {
    switch (meta.status) {
      case 'lobby':
        return 'Sin empezar';
      case 'playing':
        return 'En juego';
      case 'paused':
        return 'En pausa';
      case 'finished':
        return 'Terminada';
    }
  }

  mapName(mapId: string): string {
    return this.maps.find((map) => map.id === mapId)?.name ?? mapId;
  }

  private seatToken(): string {
    return this.isAdmin ? this.ownerUid() : localSeatToken();
  }

  private remember(name: string, roomId: string, seatId: string): void {
    localStorage.setItem('risk_player_name', name);
    localStorage.setItem('risk_room_id', roomId);
    localStorage.setItem('risk_seat_id', seatId);
  }
}
