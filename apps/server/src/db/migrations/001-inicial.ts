/** Migración 001: usuarios, sesiones, salas y el almacén de claves. */
export const sql = `
-- Migración 001: usuarios, sesiones y salas.
--
-- Las salas no saben de ningún juego concreto: \`game\` dice cuál es y
-- \`config_json\` guarda lo suyo. Un juego nuevo no toca este esquema.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'active', 'blocked')),
  created_at    INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_users_email ON users (email);

-- Los tokens de correo se guardan hasheados: quien lea la base no puede
-- verificar cuentas ajenas ni cambiar contraseñas con lo que ve.
CREATE TABLE email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
) STRICT;

CREATE INDEX idx_email_tokens_user ON email_tokens (user_id, purpose);

-- \`family_id\` agrupa la cadena de refrescos de una misma sesión. Si reaparece
-- un token ya gastado, se revoca la familia entera: un token robado deja de
-- valer en cuanto el legítimo vuelve a usarse.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  family_id  TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  ip         TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_sessions_family ON sessions (family_id);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE rooms (
  id          TEXT PRIMARY KEY,
  game        TEXT NOT NULL,
  owner_id    TEXT REFERENCES users (id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('lobby', 'playing', 'paused', 'finished')),
  config_json TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_rooms_owner ON rooms (owner_id);
CREATE INDEX idx_rooms_updated ON rooms (updated_at);

CREATE TABLE seats (
  room_id      TEXT NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  seat_id      TEXT NOT NULL,
  user_id      TEXT REFERENCES users (id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  is_bot       INTEGER NOT NULL DEFAULT 0 CHECK (is_bot IN (0, 1)),
  token_hash   TEXT NOT NULL,
  seat_order   INTEGER NOT NULL,
  connected_at INTEGER,
  PRIMARY KEY (room_id, seat_id)
) STRICT;

CREATE INDEX idx_seats_token ON seats (token_hash);

-- El log es la verdad. El snapshot es una caché que se puede tirar y
-- reconstruir volviendo a aplicar las acciones desde el principio.
CREATE TABLE room_events (
  room_id     TEXT NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  seat_id     TEXT NOT NULL,
  action_json TEXT NOT NULL,
  at          INTEGER NOT NULL,
  PRIMARY KEY (room_id, seq)
) STRICT;

CREATE TABLE room_snapshots (
  room_id    TEXT NOT NULL PRIMARY KEY REFERENCES rooms (id) ON DELETE CASCADE,
  up_to_seq  INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  at         INTEGER NOT NULL
) STRICT;

-- Lo que hoy cuelga de \`throwdown-timer/configs\` en Firebase, y lo que venga
-- con esa misma forma: una clave, un dueño y un JSON.
CREATE TABLE kv (
  namespace  TEXT NOT NULL,
  key        TEXT NOT NULL,
  owner_id   TEXT REFERENCES users (id) ON DELETE CASCADE,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (namespace, key)
) STRICT;
`;
