import { randomUUID } from 'node:crypto';
import { AppError } from '../errors';
import { hashPassword, verifyPassword } from './password';
import { generateToken, hashToken } from './tokens';
import type { Mailer } from './mailer';
import type { AuthRepository, UserRow } from './repository';
import type { PublicUser } from '@devweb/shared/contracts/auth';

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

export interface AuthServiceOptions {
  readonly repository: AuthRepository;
  readonly mailer: Mailer;
  readonly publicWebUrl: string;
  readonly refreshTtlDays: number;
  readonly now?: () => number;
}

export interface IssuedSession {
  readonly user: PublicUser;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

export interface ClientInfo {
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export class AuthService {
  private readonly repository: AuthRepository;
  private readonly mailer: Mailer;
  private readonly publicWebUrl: string;
  private readonly refreshTtlMs: number;
  private readonly now: () => number;

  constructor(options: AuthServiceOptions) {
    this.repository = options.repository;
    this.mailer = options.mailer;
    this.publicWebUrl = options.publicWebUrl.replace(/\/+$/, '');
    this.refreshTtlMs = options.refreshTtlDays * DIA;
    this.now = options.now ?? Date.now;
  }

  /**
   * Da de alta y manda el correo de verificación.
   *
   * La cuenta nace en `pending`: existe, pero no entra. Verificar es lo que la
   * activa.
   */
  async register(input: { email: string; password: string; displayName: string }): Promise<void> {
    const email = normalizeEmail(input.email);
    if (this.repository.findUserByEmail(email)) {
      throw new AppError('email-ya-registrado', 'Ese correo ya está registrado.');
    }

    const user: UserRow = {
      id: randomUUID(),
      email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName.trim(),
      status: 'pending',
      createdAt: this.now(),
    };
    this.repository.insertUser(user);

    await this.sendEmailToken(user, 'verify');
  }

  /**
   * Verifica una cuenta con un token de un solo uso.
   *
   * Se marca usado dentro de la misma operación que activa la cuenta: un token
   * de verificación que sirva dos veces es un token que sirve para siempre.
   */
  verifyEmail(token: string): void {
    const record = this.consumeEmailToken(token, 'verify');
    this.repository.updateUserStatus(record.userId, 'active');
  }

  /**
   * Entra, si puede.
   *
   * Un correo que no existe y una contraseña equivocada dan exactamente el mismo
   * error. Distinguirlos convertiría el formulario de acceso en un buscador de
   * cuentas registradas.
   */
  async login(
    input: { email: string; password: string },
    client: ClientInfo,
  ): Promise<IssuedSession> {
    const user = this.repository.findUserByEmail(normalizeEmail(input.email));
    const ok = user ? await verifyPassword(user.passwordHash, input.password) : false;

    if (!user || !ok) {
      throw new AppError('credenciales-invalidas', 'Correo o contraseña incorrectos.');
    }
    if (user.status === 'pending') {
      throw new AppError('cuenta-sin-verificar', 'Verifica tu correo antes de entrar.');
    }
    if (user.status === 'blocked') {
      throw new AppError('sin-permiso', 'Esta cuenta está bloqueada.');
    }

    return this.issueSession(user, randomUUID(), client);
  }

  /**
   * Renueva la sesión, y detecta el robo por el camino.
   *
   * Cada refresco emite un token nuevo e invalida el anterior. Si aparece uno ya
   * gastado es que hay dos manos usando la misma cadena: se revoca la familia
   * entera y ambas tienen que volver a entrar. Es lo que convierte un token
   * robado en una sesión muerta en cuanto el legítimo vuelve a usarse.
   */
  refresh(token: string, client: ClientInfo): IssuedSession {
    const session = this.repository.findSession(hashToken(token));
    if (!session) throw new AppError('sesion-caducada', 'Vuelve a iniciar sesión.');

    const now = this.now();
    if (session.revokedAt !== null) {
      this.repository.revokeFamily(session.familyId, now);
      throw new AppError('sesion-caducada', 'Vuelve a iniciar sesión.');
    }
    if (session.expiresAt <= now) {
      throw new AppError('sesion-caducada', 'Vuelve a iniciar sesión.');
    }

    const user = this.repository.findUserById(session.userId);
    if (user?.status !== 'active') {
      this.repository.revokeFamily(session.familyId, now);
      throw new AppError('sesion-caducada', 'Vuelve a iniciar sesión.');
    }

    this.repository.revokeSession(session.tokenHash, now);
    return this.issueSession(user, session.familyId, client);
  }

  logout(token: string): void {
    const session = this.repository.findSession(hashToken(token));
    if (session) this.repository.revokeFamily(session.familyId, this.now());
  }

  /**
   * Pide un cambio de contraseña.
   *
   * Devuelve lo mismo exista o no la cuenta. Si contestara distinto, cualquiera
   * podría averiguar qué correos están registrados sin más que probarlos.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = this.repository.findUserByEmail(normalizeEmail(email));
    if (!user) return;
    await this.sendEmailToken(user, 'reset');
  }

  /**
   * Cambia la contraseña y tira todas las sesiones abiertas.
   *
   * Quien cambia su contraseña casi siempre lo hace porque cree que alguien la
   * sabe. Dejar viva la sesión del intruso sería no hacer nada.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const record = this.consumeEmailToken(token, 'reset');
    this.repository.updatePassword(record.userId, await hashPassword(password));
    this.repository.updateUserStatus(record.userId, 'active');
    this.repository.revokeAllForUser(record.userId, this.now());
  }

  currentUser(userId: string): PublicUser {
    const user = this.repository.findUserById(userId);
    if (!user) throw new AppError('no-autenticado', 'No hay sesión.');
    return toPublicUser(user);
  }

  private issueSession(user: UserRow, familyId: string, client: ClientInfo): IssuedSession {
    const refreshToken = generateToken();
    const now = this.now();
    const expiresAt = now + this.refreshTtlMs;

    this.repository.insertSession({
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      familyId,
      expiresAt,
      revokedAt: null,
      ip: client.ip,
      userAgent: client.userAgent,
      createdAt: now,
    });

    return { user: toPublicUser(user), refreshToken, expiresAt };
  }

  private async sendEmailToken(user: UserRow, purpose: 'verify' | 'reset'): Promise<void> {
    // Solo un token vivo por propósito: pedir otro invalida el anterior.
    this.repository.deleteEmailTokens(user.id, purpose);

    const token = generateToken();
    this.repository.insertEmailToken({
      tokenHash: hashToken(token),
      userId: user.id,
      purpose,
      expiresAt: this.now() + DIA,
      usedAt: null,
    });

    const link =
      purpose === 'verify'
        ? `${this.publicWebUrl}/auth/verificar?token=${token}`
        : `${this.publicWebUrl}/auth/nueva-contrasena?token=${token}`;

    await this.mailer.send({
      to: user.email,
      subject: purpose === 'verify' ? 'Verifica tu cuenta de DevWeb' : 'Cambiar tu contraseña de DevWeb',
      text:
        purpose === 'verify'
          ? `Hola ${user.displayName}:\n\nActiva tu cuenta aquí:\n${link}\n\nEl enlace caduca en 24 horas.`
          : `Hola ${user.displayName}:\n\nCambia tu contraseña aquí:\n${link}\n\nEl enlace caduca en 24 horas.\nSi no lo has pedido tú, ignora este correo.`,
    });
  }

  private consumeEmailToken(token: string, purpose: 'verify' | 'reset'): { userId: string } {
    const record = this.repository.findEmailToken(hashToken(token));
    const now = this.now();

    if (record?.purpose !== purpose || record.usedAt !== null || record.expiresAt <= now) {
      throw new AppError('token-invalido', 'El enlace no vale o ha caducado.');
    }

    this.repository.markEmailTokenUsed(record.tokenHash, now);
    return { userId: record.userId };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
  };
}
