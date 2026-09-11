import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { ImpostorRoomService } from './impostor-room.service';
import { RoomSocket } from '../../api/room-socket';
import { RoomsApiService } from '../../api/rooms-api.service';
import type { SeatInfo, ServerMessage } from '@devweb/shared/contracts/rooms';
import type { ImpostorView } from '@devweb/shared/games/impostor/tipos';

const GRANT = {
  room: {
    id: 'sala-1',
    game: 'impostor',
    name: 'Quién miente',
    status: 'lobby',
    seats: [
      { id: 'asiento-1', displayName: 'Óscar', isBot: false, connected: true, isOwner: true, order: 0 },
      { id: 'bot-1', displayName: 'Doge', isBot: true, connected: true, isOwner: false, order: 1 },
      { id: 'bot-2', displayName: 'Cheems', isBot: true, connected: true, isOwner: false, order: 2 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  seatId: 'asiento-1',
  seatToken: 'pase-1',
};

const AJUSTES = {
  tema: 'comida',
  modo: 'revancha',
  vueltas: 1,
  impostores: 1,
  segundosDebate: 90,
  bots: 2,
} as const;

const EN_PISTAS = {
  fase: 'pistas',
  modo: 'clasico',
  tema: 'Comida y bebida',
  tuPalabra: 'Pizza',
  eresImpostor: false,
  orden: ['asiento-1', 'asiento-2'],
  listos: ['asiento-1', 'asiento-2'],
  eliminados: [],
  vuelta: 1,
  vueltas: 1,
  debateHasta: 0,
  segundosDebate: 90,
  turno: 'asiento-1',
  tuTurno: true,
  pistas: [],
  hanVotado: [],
  tuVoto: null,
  votos: null,
  expulsado: null,
  opciones: [],
  intento: -1,
  tuDisparo: false,
  palabra: null,
  impostores: null,
  desenlace: null,
  marcador: {},
  rondasJugadas: 0,
  dice: '',
  momento: '',
} as unknown as ImpostorView;

function asiento(id: string, cara?: string): SeatInfo {
  return {
    id,
    displayName: id.toUpperCase(),
    isBot: id.startsWith('bot'),
    connected: true,
    isOwner: id === 'asiento-1',
    order: 0,
    ...(cara && { meta: { cara } }),
  };
}

function estado(vista: ImpostorView, seats: SeatInfo[] = []): ServerMessage {
  return { tipo: 'estado', seq: 1, seats, status: 'playing', vista };
}

describe('ImpostorRoomService', () => {
  let mensajes: Subject<ServerMessage>;
  let conexion: BehaviorSubject<'cerrada' | 'conectando' | 'abierta'>;
  let socket: {
    messages$: Subject<ServerMessage>;
    estado$: BehaviorSubject<'cerrada' | 'conectando' | 'abierta'>;
    conectar: ReturnType<typeof vi.fn>;
    enviar: ReturnType<typeof vi.fn>;
    decir: ReturnType<typeof vi.fn>;
    cerrar: ReturnType<typeof vi.fn>;
  };
  let rooms: {
    crear: ReturnType<typeof vi.fn>;
    unirse: ReturnType<typeof vi.fn>;
    cambiarAsiento: ReturnType<typeof vi.fn>;
  };
  let service: ImpostorRoomService;

  beforeEach(() => {
    mensajes = new Subject<ServerMessage>();
    conexion = new BehaviorSubject<'cerrada' | 'conectando' | 'abierta'>('abierta');
    socket = {
      messages$: mensajes,
      estado$: conexion,
      conectar: vi.fn(),
      enviar: vi.fn(),
      decir: vi.fn(),
      cerrar: vi.fn(),
    };
    rooms = {
      crear: vi.fn(() => Promise.resolve(GRANT)),
      unirse: vi.fn(() => Promise.resolve(GRANT)),
      cambiarAsiento: vi.fn(() => Promise.resolve(GRANT.room)),
    };

    TestBed.configureTestingModule({
      providers: [
        ImpostorRoomService,
        { provide: RoomSocket, useValue: socket },
        { provide: RoomsApiService, useValue: rooms },
      ],
    });
    service = TestBed.inject(ImpostorRoomService);
  });

  it('empieza sin vista y sin nada dicho', () => {
    expect(service.vista()).toBeNull();
    expect(service.chat()).toEqual([]);
  });

  it('crear la sala manda las reglas de la casa y la cara elegida', async () => {
    await service.crear('Mesa', 'Óscar', AJUSTES, 'troll');

    const enviado = rooms.crear.mock.calls[0]?.[0] as {
      config?: Record<string, unknown>;
      meta?: Record<string, unknown>;
      bots?: readonly string[];
    };
    expect(enviado.config).toEqual({
      tema: 'comida',
      modo: 'revancha',
      vueltas: 1,
      impostores: 1,
      segundosDebate: 90,
    });
    expect(enviado.meta).toEqual({ cara: 'troll' });
    expect(enviado.bots).toHaveLength(2);
  });

  /** La palabra la sortea el servidor: mandarla desde aquí sería elegirla. */
  it('no manda ni palabra ni semilla al crear la sala', async () => {
    await service.crear('Mesa', 'Óscar', AJUSTES, 'troll');
    const enviado = rooms.crear.mock.calls[0]?.[0] as { config?: Record<string, unknown> };
    expect(enviado.config).not.toHaveProperty('palabra');
    expect(enviado.config).not.toHaveProperty('semilla');
  });

  it('a cada bot se le pone la cara de su nombre', async () => {
    await service.crear('Mesa', 'Óscar', AJUSTES, 'troll');

    expect(rooms.cambiarAsiento).toHaveBeenCalledWith('sala-1', 'bot-1', { meta: { cara: 'doge' } });
    expect(rooms.cambiarAsiento).toHaveBeenCalledWith('sala-1', 'bot-2', {
      meta: { cara: 'cheems' },
    });
    expect(rooms.cambiarAsiento).toHaveBeenCalledTimes(2);
  });

  /** Una cara mal repartida es fea; una mesa que no abre, un juego que no hay. */
  it('si repartir las caras falla, la mesa se abre igual', async () => {
    rooms.cambiarAsiento.mockRejectedValue(new Error('sin red'));
    await expect(service.crear('Mesa', 'Óscar', AJUSTES, 'troll')).resolves.toMatchObject({
      roomId: 'sala-1',
    });
  });

  it('sin bots no se piden asientos de bot', async () => {
    await service.crear('Mesa', 'Óscar', { ...AJUSTES, bots: 0 }, null);
    const enviado = rooms.crear.mock.calls[0]?.[0] as { bots?: readonly string[] };
    expect(enviado.bots).toBeUndefined();
  });

  it('unirse lleva la cara en el saco del asiento', async () => {
    await service.unirse('sala-1', 'Bea', 'doge');
    expect(rooms.unirse).toHaveBeenCalledWith('sala-1', 'Bea', null, { cara: 'doge' });
  });

  it('el estado que llega es el que se pinta', async () => {
    await service.crear('Mesa', 'Óscar', AJUSTES, null);
    mensajes.next(estado(EN_PISTAS));
    expect(service.vista()?.fase).toBe('pistas');
    expect(service.vista()?.tuPalabra).toBe('Pizza');
  });

  it('un no del servidor se enseña en vez de tragárselo', () => {
    mensajes.next({ tipo: 'rechazada', code: 'no-es-tu-turno', message: 'No te toca hablar.' });
    expect(service.error()).toBe('No te toca hablar.');
  });

  it('lo dicho en la mesa llega al chat', () => {
    mensajes.next({
      tipo: 'chat',
      entradas: [
        { seq: 1, authorId: 'asiento-2', author: 'Bea', kind: 'player', text: 'sospechoso', at: 0 },
      ],
    });
    expect(service.chat()).toHaveLength(1);
    expect(service.chat()[0]?.text).toBe('sospechoso');
  });

  it('una pista vacía no se manda', async () => {
    await service.crear('Mesa', 'Óscar', AJUSTES, null);
    service.pista('   ');
    expect(socket.enviar).not.toHaveBeenCalled();

    service.pista('  horno  ');
    expect(socket.enviar).toHaveBeenCalledWith({ tipo: 'pista', texto: 'horno' });
  });

  it('las caras de la mesa no se repiten aunque dos pidan la misma', () => {
    mensajes.next(estado(EN_PISTAS, [asiento('a', 'troll'), asiento('b', 'troll')]));
    expect(service.caraDe('a')).toBe('troll');
    expect(service.caraDe('b')).not.toBe('troll');
  });

  /** Una jugada con el socket cerrado se pierde: la pantalla tiene que saberlo. */
  it('sabe si la sala está escuchando', () => {
    expect(service.conectado()).toBe(true);
    conexion.next('conectando');
    expect(service.conectado()).toBe(false);
  });

  it('desconectar deja la sala en blanco', async () => {
    await service.crear('Mesa', 'Óscar', AJUSTES, null);
    mensajes.next(estado(EN_PISTAS, [asiento('a')]));
    service.desconectar();

    expect(service.vista()).toBeNull();
    expect(service.mesa()).toEqual([]);
    expect(socket.cerrar).toHaveBeenCalled();
  });
});
