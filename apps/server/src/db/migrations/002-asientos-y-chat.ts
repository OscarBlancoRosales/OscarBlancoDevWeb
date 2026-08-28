/**
 * Migración 002: lo que un juego necesita de un asiento, y el chat de sala.
 *
 * `meta_json` guarda lo que cambia de un juego a otro —en RISK el color, el
 * perfil del bot y quién creó la sala— sin meter una columna por cada cosa que
 * se le ocurra al juego siguiente. Las salas y los asientos siguen sin saber a
 * qué se juega en ellos.
 */
export const sql = `
ALTER TABLE seats ADD COLUMN meta_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE room_chat (
  room_id   TEXT NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  seq       INTEGER NOT NULL,
  author_id TEXT NOT NULL,
  author    TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('player', 'bot', 'system', 'advisor')),
  text      TEXT NOT NULL,
  origin    TEXT,
  at        INTEGER NOT NULL,
  PRIMARY KEY (room_id, seq)
) STRICT;
`;
