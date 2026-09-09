/**
 * Migración 004: quién manda, y quién puede entrar.
 *
 * El rol no se toca desde ninguna petición: lo fija `ADMIN_EMAILS` al arrancar.
 * Así, quien controla la máquina decide quién administra, y no hay endpoint que
 * ascienda a nadie — que es la puerta por la que se entra a un panel ajeno.
 *
 * Las invitaciones se guardan hasheadas, como los tokens de correo: quien
 * consiga leer la base no puede darse de alta con lo que ve. Y valen una sola
 * vez: `used_at` deja de ser nulo al gastarse, y ahí muere.
 */
export const sql = `
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

CREATE TABLE invitations (
  id         TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  note       TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  used_by    TEXT REFERENCES users (id) ON DELETE SET NULL
) STRICT;

CREATE INDEX idx_invitations_token ON invitations (token_hash);
`;
