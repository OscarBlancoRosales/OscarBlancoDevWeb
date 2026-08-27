import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from './index';

function memoryDb() {
  return openDatabase(':memory:');
}

describe('openDatabase', () => {
  it('deja las claves foráneas encendidas, que SQLite apaga por defecto', () => {
    const db = memoryDb();
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.close();
  });

  it('crea las tablas del esquema', () => {
    const db = memoryDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'users',
        'email_tokens',
        'sessions',
        'rooms',
        'seats',
        'room_events',
        'room_snapshots',
        'kv',
      ]),
    );
    db.close();
  });

  it('no reaplica una migración ya aplicada', () => {
    const db = memoryDb();
    expect(migrate(db)).toEqual([]);
    db.close();
  });

  it('rechaza un asiento de una sala que no existe', () => {
    const db = memoryDb();
    const insert = () =>
      db
        .prepare(
          'INSERT INTO seats (room_id, seat_id, display_name, token_hash, seat_order) VALUES (?, ?, ?, ?, ?)',
        )
        .run('sala-fantasma', 'a1', 'Nadie', 'hash', 0);

    expect(insert).toThrow(/FOREIGN KEY/i);
    db.close();
  });

  it('rechaza un estado de sala que no existe en el dominio', () => {
    const db = memoryDb();
    const insert = () =>
      db
        .prepare(
          'INSERT INTO rooms (id, game, name, status, config_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run('r1', 'scrum', 'Sala', 'inventado', '{}', 0, 0);

    expect(insert).toThrow(/CHECK/i);
    db.close();
  });
});
