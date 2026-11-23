/**
 * Migración 006: invitaciones a lo privado.
 *
 * Como las de alta, el código se guarda hasheado y vale una vez: quien lea la
 * base no puede canjear lo que ve, y `canjeada_en` lo mata al usarse. Caducan
 * solas aunque nadie las use.
 */
export const sql = `
CREATE TABLE invitaciones_privado (
  id          TEXT PRIMARY KEY,
  codigo_hash TEXT NOT NULL UNIQUE,
  creada_por  TEXT REFERENCES users (id) ON DELETE SET NULL,
  creada_en   INTEGER NOT NULL,
  caduca      INTEGER NOT NULL,
  canjeada_en INTEGER
) STRICT;
`;
