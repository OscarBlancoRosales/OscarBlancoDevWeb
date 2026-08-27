import type { Db } from '../db/index';

export type UserStatus = 'pending' | 'active' | 'blocked';
export type TokenPurpose = 'verify' | 'reset';

export interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly createdAt: number;
}

export interface SessionRow {
  readonly tokenHash: string;
  readonly userId: string;
  readonly familyId: string;
  readonly expiresAt: number;
  readonly revokedAt: number | null;
}

export interface EmailTokenRow {
  readonly tokenHash: string;
  readonly userId: string;
  readonly purpose: TokenPurpose;
  readonly expiresAt: number;
  readonly usedAt: number | null;
}

/**
 * Lo que el servicio necesita de la base, sin decir cómo se guarda.
 *
 * Existe como interfaz para que los tests del servicio no levanten una base de
 * datos, y para que cambiar SQLite por otra cosa no obligue a tocar ni una regla
 * de negocio.
 */
export interface AuthRepository {
  findUserByEmail(email: string): UserRow | null;
  findUserById(id: string): UserRow | null;
  insertUser(user: UserRow): void;
  updateUserStatus(id: string, status: UserStatus): void;
  updatePassword(id: string, passwordHash: string): void;

  insertEmailToken(token: EmailTokenRow): void;
  findEmailToken(tokenHash: string): EmailTokenRow | null;
  markEmailTokenUsed(tokenHash: string, at: number): void;
  deleteEmailTokens(userId: string, purpose: TokenPurpose): void;

  insertSession(session: SessionRow & { ip: string | null; userAgent: string | null; createdAt: number }): void;
  findSession(tokenHash: string): SessionRow | null;
  revokeSession(tokenHash: string, at: number): void;
  revokeFamily(familyId: string, at: number): void;
  revokeAllForUser(userId: string, at: number): void;
  deleteExpiredSessions(now: number): number;
}

interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  status: UserStatus;
  created_at: number;
}

interface SessionRecord {
  token_hash: string;
  user_id: string;
  family_id: string;
  expires_at: number;
  revoked_at: number | null;
}

interface EmailTokenRecord {
  token_hash: string;
  user_id: string;
  purpose: TokenPurpose;
  expires_at: number;
  used_at: number | null;
}

export function createAuthRepository(db: Db): AuthRepository {
  const statements = {
    findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare(
      'INSERT INTO users (id, email, password_hash, display_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    updateUserStatus: db.prepare('UPDATE users SET status = ? WHERE id = ?'),
    updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),

    insertEmailToken: db.prepare(
      'INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)',
    ),
    findEmailToken: db.prepare('SELECT * FROM email_tokens WHERE token_hash = ?'),
    markEmailTokenUsed: db.prepare('UPDATE email_tokens SET used_at = ? WHERE token_hash = ?'),
    deleteEmailTokens: db.prepare('DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?'),

    insertSession: db.prepare(
      'INSERT INTO sessions (token_hash, user_id, family_id, expires_at, revoked_at, ip, user_agent, created_at)' +
        ' VALUES (?, ?, ?, ?, NULL, ?, ?, ?)',
    ),
    findSession: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
    revokeSession: db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL'),
    revokeFamily: db.prepare('UPDATE sessions SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL'),
    revokeAllForUser: db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'),
    deleteExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  };

  return {
    findUserByEmail(email) {
      return toUser(statements.findUserByEmail.get(email) as UserRecord | undefined);
    },
    findUserById(id) {
      return toUser(statements.findUserById.get(id) as UserRecord | undefined);
    },
    insertUser(user) {
      statements.insertUser.run(
        user.id,
        user.email,
        user.passwordHash,
        user.displayName,
        user.status,
        user.createdAt,
      );
    },
    updateUserStatus(id, status) {
      statements.updateUserStatus.run(status, id);
    },
    updatePassword(id, passwordHash) {
      statements.updatePassword.run(passwordHash, id);
    },

    insertEmailToken(token) {
      statements.insertEmailToken.run(token.tokenHash, token.userId, token.purpose, token.expiresAt);
    },
    findEmailToken(tokenHash) {
      const row = statements.findEmailToken.get(tokenHash) as EmailTokenRecord | undefined;
      if (!row) return null;
      return {
        tokenHash: row.token_hash,
        userId: row.user_id,
        purpose: row.purpose,
        expiresAt: row.expires_at,
        usedAt: row.used_at,
      };
    },
    markEmailTokenUsed(tokenHash, at) {
      statements.markEmailTokenUsed.run(at, tokenHash);
    },
    deleteEmailTokens(userId, purpose) {
      statements.deleteEmailTokens.run(userId, purpose);
    },

    insertSession(session) {
      statements.insertSession.run(
        session.tokenHash,
        session.userId,
        session.familyId,
        session.expiresAt,
        session.ip,
        session.userAgent,
        session.createdAt,
      );
    },
    findSession(tokenHash) {
      const row = statements.findSession.get(tokenHash) as SessionRecord | undefined;
      if (!row) return null;
      return {
        tokenHash: row.token_hash,
        userId: row.user_id,
        familyId: row.family_id,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
      };
    },
    revokeSession(tokenHash, at) {
      statements.revokeSession.run(at, tokenHash);
    },
    revokeFamily(familyId, at) {
      statements.revokeFamily.run(at, familyId);
    },
    revokeAllForUser(userId, at) {
      statements.revokeAllForUser.run(at, userId);
    },
    deleteExpiredSessions(now) {
      return statements.deleteExpiredSessions.run(now).changes;
    },
  };
}

function toUser(row: UserRecord | undefined): UserRow | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    status: row.status,
    createdAt: row.created_at,
  };
}
