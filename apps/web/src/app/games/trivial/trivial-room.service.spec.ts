import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { TrivialRoomService } from './trivial-room.service';
import { RoomSocket } from '../../api/room-socket';
import { RoomsApiService } from '../../api/rooms-api.service';
import type { ServerMessage } from '@devweb/shared/contracts/rooms';
import type { TrivialView } from '@devweb/shared/games/trivial/tipos';

const GRANT = {
  room: {
    id: 'sala-1',
    game: 'trivial',
    name: 'Concurso',
    status: 'lobby',
    seats: [],
    createdAt: 0,
    updatedAt: 0,
  },
  seatId: 'asiento-1',
  seatToken: 'pase-1',
};

const EN_RONDA = {
  fase: 'ronda',
  ronda: 1,
  rondas: 10,
  tipo: 'test',
  enunciado: '¿Qué devuelve typeof null?',
  codigo: null,
  opciones: ['"null"', '"object"', '"undefined"', 'lanza'],
  cerrada: false,
  hanRespondido: [],
  tuRespuesta: null,
  puntos: {},
  correcta: null,
  explicacion: null,
  resultados: null,
} as unknown as TrivialView;

function estado(vista: TrivialView): ServerMessage {
  return { tipo: 'estado', seq: 1, seats: [], status: 'playing', vista };
}

describe('TrivialRoomService', () => {
  let mensajes: Subject<ServerMessage>;
  let socket: {
    messages$: Subject<ServerMessage>;
    conectar: ReturnType<typeof vi.fn>;
    enviar: ReturnType<typeof vi.fn>;
    cerrar: ReturnType<typeof vi.fn>;
  };
  let rooms: { crear: ReturnType<typeof vi.fn>; unirse: ReturnType<typeof vi.fn> };
  let service: TrivialRoomService;

  beforeEach(() => {
    mensajes = new Subject<ServerMessage>();
    socket = {
      messages$: mensajes,
      conectar: vi.fn(),
      enviar: vi.fn(),
      cerrar: vi.fn(),
    };
    rooms = {
      crear: vi.fn(() => Promise.resolve(GRANT)),
      unirse: vi.fn(() => Promise.resolve(GRANT)),
    };

    TestBed.configureTestingModule({
      providers: [
        TrivialRoomService,
        { provide: RoomSocket, useValue: socket },
        { provide: RoomsApiService, useValue: rooms },
      ],
    });
    service = TestBed.inject(TrivialRoomService);
  });

  it('empieza sin vista', () => {
    expect(service.vista()).toBeNull();
  });

  it('refleja la vista que manda el servidor', () => {
    mensajes.next(estado(EN_RONDA));
    expect(service.vista()?.enunciado).toContain('typeof null');
  });

  it('un rechazo se cuenta y no borra el concurso', () => {
    mensajes.next(estado(EN_RONDA));
    mensajes.next({ tipo: 'rechazada', code: 'ya-respondida', message: 'Ya has contestado.' });

    expect(service.error()).toBe('Ya has contestado.');
    expect(service.vista()?.fase).toBe('ronda');
  });

  it('el estado siguiente borra el error anterior', () => {
    mensajes.next({ tipo: 'rechazada', code: 'x', message: 'No.' });
    mensajes.next(estado(EN_RONDA));
    expect(service.error()).toBeNull();
  });

  it('crear contra un bot lo pide con su nivel', async () => {
    await service.crear('Concurso', 'Óscar', 'sabelotodo');

    const enviado = rooms.crear.mock.calls[0]?.[0] as {
      game: string;
      bots?: string[];
      config?: { nivelBot?: string };
    };
    expect(enviado.game).toBe('trivial');
    expect(enviado.bots).toHaveLength(1);
    expect(enviado.config?.nivelBot).toBe('sabelotodo');
    expect(socket.conectar).toHaveBeenCalledWith('sala-1', 'pase-1');
  });

  it('crear para jugar con gente no sienta bots', async () => {
    await service.crear('Concurso', 'Óscar', null);
    const enviado = rooms.crear.mock.calls[0]?.[0] as { bots?: string[] };
    expect(enviado.bots).toBeUndefined();
  });

  it('no manda semilla: la pone el servidor, y con ella las preguntas', async () => {
    await service.crear('Concurso', 'Óscar', null);
    const enviado = rooms.crear.mock.calls[0]?.[0] as { config?: Record<string, unknown> };
    expect(enviado.config?.['semilla']).toBeUndefined();
    expect(enviado.config?.['preguntas']).toBeUndefined();
  });

  it('las jugadas salen por el socket tal cual las entiende el juego', () => {
    service.empezar();
    service.responder(2);
    service.siguiente();

    const tipos = socket.enviar.mock.calls.map((llamada) => (llamada[0] as { tipo: string }).tipo);
    expect(tipos).toEqual(['empezar', 'responder', 'siguiente']);
    expect(socket.enviar.mock.calls[1]?.[0]).toEqual({ tipo: 'responder', valor: 2 });
  });

  it('desconectar cierra el socket y olvida el concurso', () => {
    mensajes.next(estado(EN_RONDA));
    service.desconectar();

    expect(socket.cerrar).toHaveBeenCalled();
    expect(service.vista()).toBeNull();
    expect(service.miAsiento).toBe('');
  });
});
