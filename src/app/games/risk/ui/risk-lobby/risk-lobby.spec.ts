import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskLobby } from './risk-lobby';
import { RISK_MAPS } from '../../engine/maps/map-registry';
import { RiskRoomService } from '../../services/risk-room.service';

function routeWith(params: Record<string, string> = {}) {
  return {
    snapshot: { queryParamMap: convertToParamMap(params) },
  };
}

async function createLobby(params: Record<string, string> = {}) {
  await TestBed.configureTestingModule({
    imports: [RiskLobby],
    providers: [provideRouter([]), { provide: ActivatedRoute, useValue: routeWith(params) }],
  }).compileComponents();
  const fixture = TestBed.createComponent(RiskLobby);
  return { fixture, component: fixture.componentInstance };
}

describe('RiskLobby', () => {
  let fixture: ComponentFixture<RiskLobby>;
  let component: RiskLobby;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    ({ fixture, component } = await createLobby());
  });

  afterEach(() => localStorage.clear());

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('ofrece todos los mapas registrados', () => {
    expect(component.maps).toEqual(RISK_MAPS);
  });

  it('arranca con el primer mapa seleccionado', () => {
    expect(component.selectedMap.id).toBe(RISK_MAPS[0].id);
  });

  it('cambiar de mapa recalcula la vista previa', () => {
    component.selectMap(RISK_MAPS[1]);
    expect(component.mapId).toBe(RISK_MAPS[1].id);
    expect(component.previewState?.mapId).toBe(RISK_MAPS[1].id);
  });

  it('la vista previa reparte el mapa entre los jugadores elegidos', () => {
    component.maxPlayers = 3;
    component.refreshPreview();
    const owners = new Set(
      Object.values(component.previewState!.territories).map((territory) => territory.ownerId),
    );
    expect(owners.size).toBe(3);
  });

  it('recorta el número de jugadores al máximo del mapa', () => {
    component.maxPlayers = 6;
    component.selectMap({ ...RISK_MAPS[0], maxPlayers: 3 });
    expect(component.maxPlayers).toBe(3);
  });

  it('las opciones de jugadores empiezan en 2', () => {
    expect(component.maxPlayersOptions[0]).toBe(2);
    expect(component.maxPlayersOptions.at(-1)).toBe(component.selectedMap.maxPlayers);
  });

  it('sin sesión no se considera administrador', () => {
    expect(component.isAdmin).toBe(false);
  });

  it('con sesión guardada sí', async () => {
    localStorage.setItem('auth_token', 'x');
    TestBed.resetTestingModule();
    const created = await createLobby();
    await created.component.ngOnInit();
    expect(created.component.isAdmin).toBe(true);
  });

  it('traduce los estados de sala a español', () => {
    const base = { status: 'lobby' } as never;
    expect(component.statusLabel({ ...(base as object), status: 'lobby' } as never)).toBe('Sin empezar');
    expect(component.statusLabel({ ...(base as object), status: 'playing' } as never)).toBe('En juego');
    expect(component.statusLabel({ ...(base as object), status: 'paused' } as never)).toBe('En pausa');
    expect(component.statusLabel({ ...(base as object), status: 'finished' } as never)).toBe('Terminada');
  });

  it('resuelve el nombre del mapa', () => {
    expect(component.mapName('world')).toBe('Todo el mundo');
    expect(component.mapName('inventado')).toBe('inventado');
  });

  it('exige un nombre de al menos dos letras', async () => {
    component.playerName = 'a';
    localStorage.removeItem('user_name');
    await component.createRoom(true);
    expect(component.error).toContain('al menos 2');
  });

  describe('partida local', () => {
    it('crea la sala, ocupa asiento y navega a la mesa', async () => {
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      await component.createRoom(true);

      const roomId = localStorage.getItem('risk_room_id')!;
      expect(roomId.startsWith('LOCAL-')).toBe(true);
      expect(localStorage.getItem('risk_seat_id')).toBeTruthy();
      expect(localStorage.getItem('risk_player_name')).toBe('Oscar');
      expect(navigate).toHaveBeenCalledWith(['/juegos/risk/mesa'], {
        queryParams: { room: roomId },
      });
    });

    it('la sala local queda guardada y se puede listar', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      component.roomName = 'Mi partida';
      await component.createRoom(true);

      const rooms = TestBed.inject(RiskRoomService).listLocalRooms();
      expect(rooms).toHaveLength(1);
      expect(rooms[0].meta.name).toBe('Mi partida');
      expect(rooms[0].meta.local).toBe(true);
      expect(rooms[0].seatCount).toBe(1);
      expect(rooms[0].humanCount).toBe(1);
    });

    it('la sala guarda la configuración elegida', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      component.autoClaim = false;
      component.tradeProgression = 'fixed';
      component.maxPlayers = 5;
      component.selectMap(RISK_MAPS[1]);
      await component.createRoom(true);

      const meta = TestBed.inject(RiskRoomService).listLocalRooms()[0].meta;
      expect(meta.config.autoClaim).toBe(false);
      expect(meta.config.tradeProgression).toBe('fixed');
      expect(meta.maxPlayers).toBe(5);
      expect(meta.mapId).toBe(RISK_MAPS[1].id);
    });

    it('volver a una sala local recupera el mismo asiento', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      await component.createRoom(true);
      const firstSeat = localStorage.getItem('risk_seat_id');

      const rooms = TestBed.inject(RiskRoomService).listLocalRooms();
      await component.resume(rooms[0]);
      expect(localStorage.getItem('risk_seat_id')).toBe(firstSeat);
    });

    it('borrar una sala la quita de la lista', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      await component.createRoom(true);
      const rooms = TestBed.inject(RiskRoomService).listLocalRooms();
      await component.deleteRoom(rooms[0], new Event('click'));
      expect(TestBed.inject(RiskRoomService).listLocalRooms()).toHaveLength(0);
    });
  });

  describe('invitación', () => {
    it('detecta el parámetro de sala', async () => {
      TestBed.resetTestingModule();
      const created = await createLobby({ room: 'LOCAL-NO-EXISTE' });
      await created.component.ngOnInit();
      expect(created.component.invitedRoomId).toBe('LOCAL-NO-EXISTE');
      expect(created.component.invitedError).toContain('ya no existe');
    });

    it('carga los datos de una sala local existente', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      await component.createRoom(true);
      const roomId = localStorage.getItem('risk_room_id')!;

      TestBed.resetTestingModule();
      const created = await createLobby({ room: roomId });
      await created.component.ngOnInit();
      expect(created.component.invitedRoom?.id).toBe(roomId);
      expect(created.component.invitedError).toBe('');
    });
  });

  it('navega a la portada de juegos', () => {
    const spy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.goToGames();
    expect(spy).toHaveBeenCalledWith(['/juegos']);
  });

  it('navega al login pasando el destino', () => {
    const spy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.goToLogin();
    expect(spy).toHaveBeenCalledWith(['/auth'], { queryParams: { next: '/juegos/risk' } });
  });
});
