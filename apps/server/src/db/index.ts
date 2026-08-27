import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { sql as inicial } from './migrations/001-inicial';

export type Db = Database.Database;

/** En orden. Nunca se edita una ya aplicada: se añade la siguiente. */
const MIGRATIONS: readonly { readonly name: string; readonly sql: string }[] = [
  { name: '001-inicial', sql: inicial },
];

/**
 * Abre la base y la deja lista para usarse.
 *
 * `WAL` permite leer mientras se escribe, que es lo que hace que una sala en
 * curso no se pare cuando otra guarda su log. `foreign_keys` está apagado por
 * defecto en SQLite: sin encenderlo, las claves foráneas del esquema serían
 * documentación, no restricciones.
 */
export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  migrate(db);
  return db;
}

/**
 * Aplica lo que falte, cada una en su transacción.
 *
 * Se guarda el nombre aplicado en la propia base para que la pregunta "¿en qué
 * versión está esto?" se le haga a la base y no a la memoria de nadie.
 */
export function migrate(db: Db): readonly string[] {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL) STRICT');

  const applied = new Set(
    db.prepare('SELECT name FROM migrations').all().map((row) => (row as { name: string }).name),
  );
  const record = db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)');
  const pending: string[] = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.name, Date.now());
    })();
    pending.push(migration.name);
  }

  return pending;
}
