import { describe, expect, it } from 'vitest';
import { RiskRoomService, aChat, aMeta, aSeat } from './risk-room.service';
import type { NgZone } from '@angular/core';
import type { RoomsApiService } from '../../../api/rooms-api.service';
import type { RoomInfo, SeatInfo } from '@devweb/shared/contracts/rooms';

const SALA: RoomInfo = {
  id: 'sala-1',
  game: 'risk',
  name: 'Partida del jueves',
  status: 'lobby',
  config: {
    mapId: 'spain-regions',
    seed: 7,
    maxPlayers: 4,
    ownerName: 'Óscar',
    reglas: { autoClaim: true, victory: 'conquest' },
  },
  seats: [],
  createdAt: 10,
  updatedAt: 20,
};

const ASIENTO: SeatInfo = {
  id: 'seat-1',
  displayName: 'Ana',
  isBot: false,
  connected: true,
  order: 2,
};

describe('la sala del servidor con la forma que espera la pantalla', () => {
  it('saca el mapa, la semilla y las reglas de la caja que el servidor no abre', () => {
    const meta = aMeta(SALA, 'uid-1');

    expect(meta).toMatchObject({
      id: 'sala-1',
      name: 'Partida del jueves',
      status: 'lobby',
      mapId: 'spain-regions',
      seed: 7,
      maxPlayers: 4,
      ownerName: 'Óscar',
      ownerUid: 'uid-1',
      config: { autoClaim: true, victory: 'conquest' },
    });
  });

  it('una sala sin configuración no rompe: se juega el mapa de siempre', () => {
    const meta = aMeta({ ...SALA, config: {} }, '');

    expect(meta).toMatchObject({ mapId: 'world', seed: 1, maxPlayers: 6, ownerName: '' });
  });

  it('el dueño no viaja en la sala: lo pone quien pregunta, y solo por sus salas', () => {
    expect(aMeta(SALA, '').ownerUid).toBe('');
  });

  it('la alineación congelada se conserva si la hay', () => {
    const roster = [{ id: 'a', name: 'Ana', kind: 'human', color: 'rojo', seatToken: 'a' }];
    const meta = aMeta({ ...SALA, config: { ...SALA.config, roster } }, '');

    expect(meta.roster).toEqual(roster);
  });
});

describe('los asientos', () => {
  it('traen el color y el carácter del bot de sus metadatos', () => {
    const seat = aSeat({ ...ASIENTO, isBot: true, meta: { color: 'azul', botProfile: 'cauto' } });

    expect(seat).toMatchObject({ kind: 'bot', color: 'azul', botProfile: 'cauto', order: 2 });
  });

  it('el pase no viaja: la identidad dentro del cliente es el propio asiento', () => {
    const seat = aSeat({ ...ASIENTO, meta: { color: 'rojo', seatToken: 'secreto' } });

    expect(seat.seatToken).toBe('seat-1');
    expect(JSON.stringify(seat)).not.toContain('secreto');
  });

  it('un asiento sin metadatos sigue siendo un asiento', () => {
    expect(aSeat(ASIENTO)).toMatchObject({
      id: 'seat-1',
      name: 'Ana',
      kind: 'human',
      connected: true,
      color: '',
      isOwner: false,
    });
  });
});

describe('el chat', () => {
  const ENTRADA = {
    seq: 3,
    authorId: 'seat-1',
    author: 'Ana',
    kind: 'player' as const,
    text: 'voy a por Aragón',
    at: 1234,
  };

  it('la clave ordena alfabéticamente igual que numéricamente', () => {
    const claves = [1, 2, 10, 40].map((seq) => aChat({ ...ENTRADA, seq }).key);

    expect([...claves].sort()).toEqual(claves);
  });

  it('el origen solo se conserva si es uno de los conocidos', () => {
    expect(aChat({ ...ENTRADA, origin: 'llm' }).origin).toBe('llm');
    expect(aChat({ ...ENTRADA, origin: 'inventado' }).origin).toBeUndefined();
  });
});

describe('crear una sala y sentarse en ella', () => {
  class ApiDeMentira {
    unidas = 0;
    sala: RoomInfo = { ...SALA, seats: [] };

    crear(): Promise<{ room: RoomInfo; seatId: string; seatToken: string }> {
      const asiento: SeatInfo = { ...ASIENTO, id: 'seat-duenyo', displayName: 'Óscar', order: 0 };
      this.sala = { ...this.sala, seats: [asiento] };
      return Promise.resolve({ room: this.sala, seatId: asiento.id, seatToken: 'pase-duenyo' });
    }

    unirse(): Promise<{ room: RoomInfo; seatId: string; seatToken: string }> {
      this.unidas += 1;
      const asiento: SeatInfo = { ...ASIENTO, id: 'seat-nuevo', order: this.sala.seats.length };
      this.sala = { ...this.sala, seats: [...this.sala.seats, asiento] };
      return Promise.resolve({ room: this.sala, seatId: asiento.id, seatToken: 'pase-nuevo' });
    }

    info(): Promise<RoomInfo> {
      return Promise.resolve(this.sala);
    }

    cambiarAsiento(): Promise<RoomInfo> {
      return Promise.resolve(this.sala);
    }
  }

  /** Una zona que no agrupa nada: aquí no se pinta, solo se llama. */
  const zonaQuieta = {
    runOutsideAngular: (fn: () => unknown) => fn(),
    run: (fn: () => unknown) => fn(),
  } as NgZone;

  function servicio(api: ApiDeMentira): RiskRoomService {
    localStorage.clear();
    return new RiskRoomService(api as unknown as RoomsApiService, zonaQuieta);
  }

  it('quien crea la sala ya está sentado: no se sienta dos veces', async () => {
    const api = new ApiDeMentira();
    const rooms = servicio(api);

    const meta = await rooms.createRoom({
      name: 'Partida',
      mapId: 'spain-regions',
      maxPlayers: 4,
      ownerUid: 'uid-1',
      ownerName: 'Óscar',
      config: {} as never,
    });
    const seatId = await rooms.claimSeat(meta.id, {
      name: 'Óscar',
      seatToken: 'uid-1',
      color: 'rojo',
      isOwner: true,
    });

    expect(seatId).toBe('seat-duenyo');
    expect(api.unidas).toBe(0);
  });

  it('quien llega por invitación se sienta una vez, y al volver recupera su silla', async () => {
    const api = new ApiDeMentira();
    const rooms = servicio(api);
    await api.crear();

    const primera = await rooms.claimSeat(SALA.id, { name: 'Ana', seatToken: 'x', color: 'azul' });
    const segunda = await rooms.claimSeat(SALA.id, { name: 'Ana', seatToken: 'x', color: 'azul' });

    expect(primera).toBe('seat-nuevo');
    expect(segunda).toBe('seat-nuevo');
    expect(api.unidas).toBe(1);
  });
});
