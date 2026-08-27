import { describe, expect, it } from 'vitest';
import {
  LocalRoomStore,
  isLocalRoomId,
  sequentialKey,
  toChatList,
  toLogList,
  toSeatList,
} from './local-room-store';
import { RoomMeta, RoomSeat } from './risk-room.service';
import { DEFAULT_CONFIG } from '../engine/engine';

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  } as Storage;
}

function meta(id = 'LOCAL-AAAA-BBBB'): RoomMeta {
  return {
    id,
    name: 'Sala de pruebas',
    mapId: 'world',
    maxPlayers: 4,
    seed: 42,
    status: 'lobby',
    createdAt: 1,
    updatedAt: 1,
    ownerUid: 'owner',
    ownerName: 'Owner',
    config: DEFAULT_CONFIG,
    inviteCode: 'ABC123',
    local: true,
  };
}

function seat(id: string, order: number): RoomSeat {
  return {
    id,
    name: id,
    kind: 'human',
    seatToken: `token-${id}`,
    color: '#fff',
    order,
    joinedAt: order,
    lastSeen: 0,
    connected: true,
    isOwner: order === 0,
  };
}

describe('almacén de salas locales', () => {
  describe('isLocalRoomId', () => {
    it('distingue las salas locales de las de la nube', () => {
      expect(isLocalRoomId('LOCAL-AAAA-BBBB')).toBe(true);
      expect(isLocalRoomId('RISK-AAAA-BBBB')).toBe(false);
    });
  });

  describe('sequentialKey', () => {
    it('genera claves que se ordenan alfabéticamente igual que numéricamente', () => {
      const keys = [0, 1, 2, 9, 10, 35, 36, 100, 1000].map(sequentialKey);
      expect([...keys].sort()).toEqual(keys);
    });

    it('todas tienen la misma longitud', () => {
      const lengths = new Set([0, 1, 999999].map((n) => sequentialKey(n).length));
      expect(lengths.size).toBe(1);
    });
  });

  describe('ciclo de vida', () => {
    it('crea y lee una sala', () => {
      const store = new LocalRoomStore(fakeStorage());
      store.create(meta());
      const read = store.read('LOCAL-AAAA-BBBB');
      expect(read?.meta.name).toBe('Sala de pruebas');
      expect(read?.seats).toEqual({});
      expect(read?.log).toEqual({});
    });

    it('devuelve null si la sala no existe', () => {
      expect(new LocalRoomStore(fakeStorage()).read('LOCAL-NADA')).toBeNull();
    });

    it('aguanta datos corruptos', () => {
      const storage = fakeStorage();
      storage.setItem('risk_local_room_LOCAL-X', 'no soy json');
      expect(new LocalRoomStore(storage).read('LOCAL-X')).toBeNull();
    });

    it('lista las salas creadas, la más reciente primero', () => {
      const store = new LocalRoomStore(fakeStorage());
      store.create({ ...meta('LOCAL-1'), updatedAt: 10 });
      store.create({ ...meta('LOCAL-2'), updatedAt: 20 });
      expect(store.list().map((room) => room.meta.id)).toEqual(['LOCAL-2', 'LOCAL-1']);
    });

    it('borra una sala y la saca del índice', () => {
      const store = new LocalRoomStore(fakeStorage());
      store.create(meta('LOCAL-1'));
      store.delete('LOCAL-1');
      expect(store.read('LOCAL-1')).toBeNull();
      expect(store.listIds()).toEqual([]);
    });

    it('no duplica entradas en el índice al reescribir', () => {
      const store = new LocalRoomStore(fakeStorage());
      store.create(meta('LOCAL-1'));
      store.update('LOCAL-1', (data) => {
        data.meta.name = 'otro';
      });
      expect(store.listIds()).toEqual(['LOCAL-1']);
    });

    it('update refresca la marca de tiempo', () => {
      const store = new LocalRoomStore(fakeStorage());
      store.create({ ...meta(), updatedAt: 0 });
      const updated = store.update('LOCAL-AAAA-BBBB', (data) => {
        data.meta.status = 'playing';
      });
      expect(updated!.meta.status).toBe('playing');
      expect(updated!.meta.updatedAt).toBeGreaterThan(0);
    });

    it('update sobre una sala inexistente devuelve null', () => {
      expect(new LocalRoomStore(fakeStorage()).update('LOCAL-NADA', () => {})).toBeNull();
    });
  });

  describe('log y chat', () => {
    it('añade acciones en orden', () => {
      const store = new LocalRoomStore(fakeStorage());
      store.create(meta());
      for (let i = 0; i < 12; i++) {
        store.appendAction('LOCAL-AAAA-BBBB', { type: 'end-phase', playerId: `p${i}` }, `p${i}`);
      }
      const list = toLogList(store.read('LOCAL-AAAA-BBBB'));
      expect(list).toHaveLength(12);
      expect(list.map((entry) => entry.action.playerId)).toEqual(
        Array.from({ length: 12 }, (_, i) => `p${i}`),
      );
    });

    it('añade mensajes de chat en orden', () => {
      const store = new LocalRoomStore(fakeStorage());
      store.create(meta());
      for (const text of ['uno', 'dos', 'tres']) {
        store.appendChat('LOCAL-AAAA-BBBB', {
          authorId: 'a',
          author: 'A',
          kind: 'player',
          text,
          ts: 1,
        });
      }
      expect(toChatList(store.read('LOCAL-AAAA-BBBB')).map((e) => e.text)).toEqual([
        'uno',
        'dos',
        'tres',
      ]);
    });

    it('guarda el punto de control', () => {
      const store = new LocalRoomStore(fakeStorage());
      store.create(meta());
      store.setSnapshot('LOCAL-AAAA-BBBB', 7, { mapId: 'world' } as never);
      const snapshot = store.read('LOCAL-AAAA-BBBB')!.snapshot!;
      expect(snapshot.upTo).toBe(7);
      expect(snapshot.state.mapId).toBe('world');
    });
  });

  describe('conversión a listas', () => {
    it('ordena los asientos por orden y antigüedad', () => {
      const store = new LocalRoomStore(fakeStorage());
      store.create(meta());
      store.update('LOCAL-AAAA-BBBB', (data) => {
        data.seats['c'] = seat('c', 2);
        data.seats['a'] = seat('a', 0);
        data.seats['b'] = seat('b', 1);
      });
      expect(toSeatList(store.read('LOCAL-AAAA-BBBB')).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    });

    it('devuelve listas vacías si no hay sala', () => {
      expect(toSeatList(null)).toEqual([]);
      expect(toLogList(null)).toEqual([]);
      expect(toChatList(null)).toEqual([]);
    });
  });
});
