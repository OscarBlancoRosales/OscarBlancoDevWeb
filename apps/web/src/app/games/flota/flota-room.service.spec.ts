import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { FlotaRoomService } from './flota-room.service';
import { RoomSocket } from '../../api/room-socket';
import { RoomsApiService } from '../../api/rooms-api.service';
import type { ServerMessage } from '@devweb/shared/contracts/rooms';
import type { FlotaView } from '@devweb/shared/games/flota/tipos';

const GRANT = {
  room: { id: 'sala-1', game: 'flota', name: 'Mesa', status: 'lobby', seats: [], createdAt: 0, updatedAt: 0 },
  seatId: 'asiento-1',
  seatToken: 'pase-1',
};

const VISTA_EN_COMBATE = {
  fase: 'combate',
  turno: 'asiento-1',
  ganador: null,
  desplegados: ['asiento-1', 'bot'],
  tuyo: { barcos: [], recibidos: [] },
  rivalId: 'bot',
  disparosSobreRival: [],
  flotaRival: null,
  punteriaTuya: null,
  punteriaRival: null,
} as unknown as FlotaView;

function estado(vista: FlotaView): ServerMessage {
  return { tipo: 'estado', seq: 1, seats: [], status: 'playing', vista };
}

describe('FlotaRoomService', () => {
  let mensajes: Subject<ServerMessage>;
  let socket: { conectar: ReturnType<typeof vi.fn>; enviar: ReturnType<typeof vi.fn>; cerrar: ReturnType<typeof vi.fn>; messages$: Subject<ServerMessage> };
  let rooms: { crear: ReturnType<typeof vi.fn>; unirse: ReturnType<typeof vi.fn> };
  let service: FlotaRoomService;

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
        FlotaRoomService,
        { provide: RoomSocket, useValue: socket },
        { provide: RoomsApiService, useValue: rooms },
      ],
    });
    service = TestBed.inject(FlotaRoomService);
  });

  it('empieza sin vista', () => {
    expect(service.vista()).toBeNull();
  });

  it('refleja la vista que manda el servidor', () => {
    mensajes.next(estado(VISTA_EN_COMBATE));
    expect(service.vista()?.fase).toBe('combate');
  });

  it('un rechazo se cuenta y no borra la partida', () => {
    mensajes.next(estado(VISTA_EN_COMBATE));
    mensajes.next({ tipo: 'rechazada', code: 'ya-disparado', message: 'Ahí ya has disparado.' });

    expect(service.error()).toBe('Ahí ya has disparado.');
    expect(service.vista()?.fase).toBe('combate');
  });

  it('el estado siguiente borra el error anterior', () => {
    mensajes.next({ tipo: 'rechazada', code: 'x', message: 'No.' });
    mensajes.next(estado(VISTA_EN_COMBATE));
    expect(service.error()).toBeNull();
  });

  it('crear contra un bot lo pide con su nivel', async () => {
    await service.crear('Mesa', 'Óscar', 'almirante');

    const enviado = rooms.crear.mock.calls[0]?.[0] as {
      game: string;
      bots?: string[];
      config?: { nivelBot?: string };
    };
    expect(enviado.game).toBe('flota');
    expect(enviado.bots).toEqual(['Almirante']);
    expect(enviado.config?.nivelBot).toBe('almirante');
    expect(socket.conectar).toHaveBeenCalledWith('sala-1', 'pase-1');
  });

  it('crear para jugar con otra persona no sienta bots', async () => {
    await service.crear('Mesa', 'Óscar', null);
    const enviado = rooms.crear.mock.calls[0]?.[0] as { bots?: string[] };
    expect(enviado.bots).toBeUndefined();
  });

  it('cada sala lleva su propia semilla', async () => {
    await service.crear('Mesa', 'Óscar', 'marino');
    await service.crear('Otra', 'Óscar', 'marino');

    const semillas = rooms.crear.mock.calls.map(
      (llamada) => (llamada[0] as { config?: { semilla?: number } }).config?.semilla,
    );
    expect(semillas[0]).not.toBe(semillas[1]);
  });

  it('las jugadas salen por el socket tal cual las entiende el juego', () => {
    service.desplegar([{ fila: 0, columna: 0, tamano: 2, orientacion: 'horizontal' }]);
    service.disparar(3, 4);
    service.rendirse();

    const tipos = socket.enviar.mock.calls.map((llamada) => (llamada[0] as { tipo: string }).tipo);
    expect(tipos).toEqual(['desplegar', 'disparar', 'rendirse']);
    expect(socket.enviar.mock.calls[1]?.[0]).toEqual({ tipo: 'disparar', fila: 3, columna: 4 });
  });

  it('desconectar cierra el socket y olvida la partida', () => {
    mensajes.next(estado(VISTA_EN_COMBATE));
    service.desconectar();

    expect(socket.cerrar).toHaveBeenCalled();
    expect(service.vista()).toBeNull();
    expect(service.miAsiento).toBe('');
  });
});
