import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskLobby } from './risk-lobby';
import { RISK_MAPS } from '../../engine/maps/map-registry';
import { RiskRoomService } from '../../services/risk-room.service';
import { FirebaseAuthService } from '../../../../firebase-auth.service';
import { of } from 'rxjs';

function routeWith(params: Record<string, string> = {}) {
  return {
    snapshot: { queryParamMap: convertToParamMap(params) },
  };
}

/** Monta el lobby con una sesión de Firebase de mentira pero con la forma real. */
async function createLobbyWithUser(user: { uid: string; email: string } | null) {
  await TestBed.configureTestingModule({
    imports: [RiskLobby],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: routeWith({}) },
      {
        provide: FirebaseAuthService,
        useValue: { user$: of(user), currentUser: user },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(RiskLobby);
  return { fixture, component: fixture.componentInstance };
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

  it('una bandera en el navegador NO te hace administrador', async () => {
    // Era el fallo: el candado miraba `localStorage.auth_token`, un texto que
    // cualquiera pone desde la consola del navegador. La base de datos exige una
    // sesión de verdad, así que fiarse de la bandera solo servía para enseñar un
    // botón que iba a fallar después.
    localStorage.setItem('auth_token', 'me-lo-he-inventado');
    TestBed.resetTestingModule();
    const created = await createLobby();
    await created.component.ngOnInit();
    expect(created.component.isAdmin).toBe(false);
  });

  it('con sesión de Firebase de verdad, sí', async () => {
    TestBed.resetTestingModule();
    const created = await createLobbyWithUser({ uid: 'uid-real', email: 'oscar@ejemplo.com' });
    await created.component.ngOnInit();
    expect(created.component.isAdmin).toBe(true);
    expect(created.component.ownerUid()).toBe('uid-real');
    expect(created.component.ownerName()).toBe('oscar');
  });

  it('sin sesión, el dueño va vacío y no se inventa un identificador', async () => {
    // Un `ownerUid` inventado quedaría escrito en `meta`, que es inmutable, y
    // como las reglas solo dejan listar tus salas comparando con `auth.uid`, la
    // sala quedaría creada pero invisible para siempre.
    expect(component.ownerUid()).toBe('');
  });

  it('sin sesión no se llega a llamar a la base al crear online', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const rooms = TestBed.inject(RiskRoomService);
    const create = vi.spyOn(rooms, 'createRoom');
    component.playerName = 'Oscar';
    await component.createRoom(false);
    expect(create).not.toHaveBeenCalled();
    expect(component.error).toContain('sesión');
  });

  it('traduce los estados de sala a español', () => {
    const base = { status: 'lobby' } as never;
    expect(component.statusLabel({ ...(base as object), status: 'lobby' } as never)).toBe('Sin empezar');
    expect(component.statusLabel({ ...(base as object), status: 'playing' } as never)).toBe('En juego');
    expect(component.statusLabel({ ...(base as object), status: 'paused' } as never)).toBe('En pausa');
    expect(component.statusLabel({ ...(base as object), status: 'finished' } as never)).toBe('Terminada');
  });

  describe('modo avanzado', () => {
    it('empieza apagado: el clásico es lo que se ofrece por defecto', () => {
      expect(component.advancedTerrain).toBe(false);
    });

    it('la leyenda lista los cinco terrenos con su efecto', () => {
      expect(component.terrains).toHaveLength(5);
      for (const terrain of component.terrains) {
        expect(terrain.name.length).toBeGreaterThan(0);
        expect(terrain.defence.length).toBeGreaterThan(10);
        expect(terrain.assault.length).toBeGreaterThan(10);
      }
    });

    it('con el modo apagado no se enseña la leyenda', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.terrain-legend')).toBeNull();
    });

    it('con el modo encendido la leyenda lista los cinco terrenos', () => {
      component.advancedTerrain = true;
      fixture.detectChanges();
      const legend = fixture.nativeElement.querySelector('.terrain-legend');
      expect(legend).not.toBeNull();
      expect(legend.querySelectorAll('.terrain-item').length).toBe(5);
    });

    it('la vista previa marca la orografía al encenderlo', () => {
      component.advancedTerrain = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.badge-terrain').length).toBeGreaterThan(0);
    });
  });

  describe('tropas especializadas', () => {
    it('empiezan apagadas', () => {
      expect(component.advancedUnits).toBe(false);
    });

    it('la leyenda lista las cuatro tropas con coste y efecto', () => {
      expect(component.troops).toHaveLength(4);
      for (const troop of component.troops) {
        expect(troop.cost).toBeGreaterThan(0);
        expect(troop.effect.length).toBeGreaterThan(10);
      }
    });

    it('con el modo encendido aparece su leyenda', () => {
      component.advancedUnits = true;
      fixture.detectChanges();
      const legends = fixture.nativeElement.querySelectorAll('.terrain-legend');
      expect(legends.length).toBe(1);
      expect(legends[0].querySelectorAll('.terrain-item').length).toBe(4);
    });

    it('orografía y tropas son independientes', () => {
      component.advancedTerrain = true;
      component.advancedUnits = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.terrain-legend').length).toBe(2);
    });
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

    it('el modo avanzado viaja a la configuración de la sala', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      component.advancedTerrain = true;
      await component.createRoom(true);

      const meta = TestBed.inject(RiskRoomService).listLocalRooms()[0].meta;
      expect(meta.config.advancedTerrain).toBe(true);
    });

    it('sin marcar el modo avanzado la sala queda en clásico', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      await component.createRoom(true);

      const meta = TestBed.inject(RiskRoomService).listLocalRooms()[0].meta;
      expect(meta.config.advancedTerrain).toBe(false);
      expect(meta.config.advancedUnits).toBe(false);
    });

    it('la forma de ganar viaja a la configuración de la sala', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      expect(component.victory).toBe('conquest');
      component.victory = 'objectives';
      await component.createRoom(true);

      const meta = TestBed.inject(RiskRoomService).listLocalRooms()[0].meta;
      expect(meta.config.victory).toBe('objectives');
    });

    it('las tropas viajan a la configuración de la sala por su cuenta', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      component.advancedUnits = true;
      await component.createRoom(true);

      const meta = TestBed.inject(RiskRoomService).listLocalRooms()[0].meta;
      expect(meta.config.advancedUnits).toBe(true);
      expect(meta.config.advancedTerrain).toBe(false);
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

    it('una sala local siempre se puede borrar', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.playerName = 'Oscar';
      await component.createRoom(true);
      await component.loadSavedRooms();
      expect(component.canDelete(component.savedRooms[0])).toBe(true);
    });

    it('una sala online ajena no ofrece el botón de borrar', () => {
      // Las reglas de la base solo dejan borrarla a quien la creó, así que el
      // botón no debe prometer algo que va a ser rechazado.
      const ajena = {
        meta: { id: 'ABC', local: false, ownerUid: 'otra-persona' },
      } as unknown as Parameters<typeof component.canDelete>[0];
      expect(component.canDelete(ajena)).toBe(false);
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
