import type { Db } from '../db/index';

export type UserStatus = 'pending' | 'active' | 'blocked';
export type UserRole = 'user' | 'admin';
export type TokenPurpose = 'verify' | 'reset';

export interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly role: UserRole;
  readonly createdAt: number;
}

/**
 * Una invitación. Vale una sola vez y no va atada a ningún correo: quien tenga
 * el enlace se registra con la dirección que quiera, y ahí se gasta.
 */
export interface InvitationRow {
  readonly id: string;
  readonly tokenHash: string;
  readonly note: string;
  readonly createdBy: string | null;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly usedAt: number | null;
  readonly usedBy: string | null;
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

  listUsers(): readonly UserRow[];
  deleteUser(id: string): void;
  /** Deja como admin exactamente a esos correos, y a nadie más. */
  setAdmins(emails: readonly string[]): void;

  insertInvitation(invitation: InvitationRow): void;
  findInvitation(tokenHash: string): InvitationRow | null;
  listInvitations(): readonly InvitationRow[];
  markInvitationUsed(tokenHash: string, userId: string, at: number): void;
  deleteInvitation(id: string): void;

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
  role: UserRole;
  created_at: number;
}

interface InvitationRecord {
  id: string;
  token_hash: string;
  note: string;
  created_by: string | null;
  created_at: number;
  expires_at: number;
  used_at: number | null;
  used_by: string | null;
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
      'INSERT INTO users (id, email, password_hash, display_name, status, role, created_at)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    updateUserStatus: db.prepare('UPDATE users SET status = ? WHERE id = ?'),
    updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    listUsers: db.prepare('SELECT * FROM users ORDER BY created_at'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    quitarAdmins: db.prepare("UPDATE users SET role = 'user' WHERE role = 'admin'"),
    hacerAdmin: db.prepare("UPDATE users SET role = 'admin' WHERE email = ?"),

    insertInvitation: db.prepare(
      'INSERT INTO invitations (id, token_hash, note, created_by, created_at, expires_at, used_at, used_by)' +
        ' VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)',
    ),
    findInvitation: db.prepare('SELECT * FROM invitations WHERE token_hash = ?'),
    listInvitations: db.prepare('SELECT * FROM invitations ORDER BY created_at DESC'),
    markInvitationUsed: db.prepare(
      'UPDATE invitations SET used_at = ?, used_by = ? WHERE token_hash = ? AND used_at IS NULL',
    ),
    deleteInvitation: db.prepare('DELETE FROM invitations WHERE id = ?'),

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
        user.role,
        user.createdAt,
      );
    },
    updateUserStatus(id, status) {
      statements.updateUserStatus.run(status, id);
    },
    updatePassword(id, passwordHash) {
      statements.updatePassword.run(passwordHash, id);
    },

    listUsers() {
      return (statements.listUsers.all() as UserRecord[]).flatMap((row) => {
        const user = toUser(row);
        return user ? [user] : [];
      });
    },
    deleteUser(id) {
      statements.deleteUser.run(id);
    },

    /**
     * Quién administra se declara fuera, y aquí solo se obedece.
     *
     * Primero se quita a todos y luego se pone a los de la lista, en una sola
     * transacción: así el fichero de configuración es la verdad completa y
     * quitar un correo de allí quita el rol de verdad, en vez de dejarlo puesto
     * para siempre porque una vez estuvo.
     */
    setAdmins(emails) {
      const aplicar = db.transaction((lista: readonly string[]) => {
        statements.quitarAdmins.run();
        for (const email of lista) statements.hacerAdmin.run(email);
      });
      aplicar(emails);
    },

    insertInvitation(invitation) {
      statements.insertInvitation.run(
        invitation.id,
        invitation.tokenHash,
        invitation.note,
        invitation.createdBy,
        invitation.createdAt,
        invitation.expiresAt,
      );
    },
    findInvitation(tokenHash) {
      const row = statements.findInvitation.get(tokenHash) as InvitationRecord | undefined;
      return row ? toInvitation(row) : null;
    },
    listInvitations() {
      return (statements.listInvitations.all() as InvitationRecord[]).map(toInvitation);
    },
    markInvitationUsed(tokenHash, userId, at) {
      statements.markInvitationUsed.run(at, userId, tokenHash);
    },
    deleteInvitation(id) {
      statements.deleteInvitation.run(id);
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
    role: row.role,
    createdAt: row.created_at,
  };
}

function toInvitation(row: InvitationRecord): InvitationRow {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    usedBy: row.used_by,
  };
}
