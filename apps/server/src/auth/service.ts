import { randomUUID } from 'node:crypto';
import { AppError } from '../errors';
import { hashPassword, verifyPassword, wastePasswordTime } from './password';
import { generateToken, hashToken } from './tokens';
import type { Mailer } from './mailer';
import type { AuthRepository, InvitationRow, UserRow } from './repository';
import type { PublicUser } from '@devweb/shared/contracts/auth';

/**
 * Cómo se llama esto de cara a quien lo usa.
 *
 * «DevWeb» es el nombre del repositorio, y se coló en el asunto de todos los
 * correos de alta hasta que alguien recibió uno y lo dijo. Lo que lee la gente
 * no tiene por qué llamarse como la carpeta donde vive el código.
 */
export const NOMBRE_DEL_SITIO = 'OBRWeb';

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

export interface AuthServiceOptions {
  readonly repository: AuthRepository;
  readonly mailer: Mailer;
  readonly publicWebUrl: string;
  readonly refreshTtlDays: number;
  readonly now?: () => number;
  /** Lo que hay que llevarse además de la cuenta cuando se borra. */
  readonly alBorrarUsuario?: (userId: string) => void;
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

  /**
   * Qué más hay que llevarse cuando se borra una cuenta.
   *
   * Va como aviso y no como dependencia porque el servicio de sesiones no tiene
   * por qué saber que existen las salas: quien las conoce es quien monta la
   * aplicación, y es ahí donde se decide qué arrastra un borrado.
   */
  private readonly alBorrarUsuario: ((userId: string) => void) | undefined;

  constructor(options: AuthServiceOptions) {
    this.alBorrarUsuario = options.alBorrarUsuario;
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
   *
   * Y hace falta una invitación. Se comprueba ANTES que nada —antes incluso de
   * mirar si el correo existe— porque sin eso el alta seguiría sirviendo para
   * averiguar quién está registrado: bastaría con probar correos y ver a cuál
   * le llega el aviso.
   */
  async register(input: {
    email: string;
    password: string;
    displayName: string;
    invitacion: string;
  }): Promise<void> {
    const invitacion = this.invitacionUtilizable(input.invitacion);
    if (!invitacion) {
      throw new AppError('invitacion-invalida', 'Esa invitación no vale o ya se ha usado.');
    }

    const email = normalizeEmail(input.email);

    // Contestar "ese correo ya está registrado" convierte el alta en un
    // comprobador de cuentas: se prueban mil correos y se sabe cuáles existen.
    // Se contesta lo mismo siempre y se avisa al dueño de la cuenta, que es
    // quien tiene derecho a enterarse del intento.
    const existente = this.repository.findUserByEmail(email);
    if (existente) {
      await this.mailer.send({
        to: existente.email,
        subject: 'Alguien ha intentado registrarse con tu correo',
        text:
          `Hola ${existente.displayName}:\n\n` +
          `Alguien ha intentado crear una cuenta en ${NOMBRE_DEL_SITIO} con este correo, ` +
          'que ya ' +
          'tiene una.\n\nSi has sido tú, entra con tu contraseña de siempre. Si la ' +
          'has olvidado, pide una nueva desde la pantalla de acceso.\n\n' +
          'Si no has sido tú, no tienes que hacer nada: tu cuenta no ha cambiado.',
      });
      return;
    }

    const user: UserRow = {
      id: randomUUID(),
      email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName.trim(),
      status: 'pending',
      role: 'user',
      createdAt: this.now(),
    };
    this.repository.insertUser(user);
    // Se gasta aquí, no al verificar: si no, un mismo enlace daría de alta a
    // media docena de personas mientras ninguna abriera su correo.
    this.repository.markInvitationUsed(hashToken(input.invitacion), user.id, this.now());

    await this.sendEmailToken(user, 'verify');
  }

  /** La invitación que sirve para darse de alta ahora mismo, o `null`. */
  private invitacionUtilizable(token: string): InvitationRow | null {
    if (!token) return null;
    const invitacion = this.repository.findInvitation(hashToken(token));
    if (!invitacion) return null;
    if (invitacion.usedAt !== null) return null;
    if (invitacion.expiresAt <= this.now()) return null;
    return invitacion;
  }

  // ===== ADMINISTRACIÓN =====

  /**
   * Deja como administradores exactamente a esos correos.
   *
   * Se llama al arrancar con lo que diga la configuración de la máquina, y por
   * eso no hay ninguna ruta que ascienda a nadie: quien manda es quien tiene
   * acceso al servidor, no quien consigue una sesión con suerte. Quitar un
   * correo del fichero le quita el rol en el siguiente arranque.
   */
  fijarAdministradores(emails: readonly string[]): void {
    this.repository.setAdmins(emails.map((email) => normalizeEmail(email)));
  }

  listarUsuarios(): PublicUser[] {
    return this.repository.listUsers().map(toPublicUser);
  }

  cambiarEstado(userId: string, status: 'active' | 'blocked'): PublicUser {
    const user = this.repository.findUserById(userId);
    if (!user) throw new AppError('no-encontrado', 'Esa cuenta no existe.');
    if (user.role === 'admin') {
      throw new AppError('sin-permiso', 'A un administrador no se le toca desde aquí.');
    }

    this.repository.updateUserStatus(userId, status);
    // Bloquear a alguien que sigue con la sesión abierta no le bloquea nada
    // hasta que caduque: hay que echarlo ahora.
    if (status === 'blocked') this.repository.revokeAllForUser(userId, this.now());
    return toPublicUser({ ...user, status });
  }

  /**
   * Borra una cuenta. Lo suyo se va con ella.
   *
   * Un administrador no se borra desde aquí: si el rol sale de la configuración
   * de la máquina, borrarlo por una petición dejaría el sistema diciendo una
   * cosa y comportándose de otra hasta el siguiente arranque.
   */
  borrarUsuario(userId: string): void {
    const user = this.repository.findUserById(userId);
    if (!user) throw new AppError('no-encontrado', 'Esa cuenta no existe.');
    if (user.role === 'admin') {
      throw new AppError('sin-permiso', 'A un administrador no se le borra desde aquí.');
    }

    this.repository.revokeAllForUser(userId, this.now());
    this.repository.deleteUser(userId);
    this.alBorrarUsuario?.(userId);
  }

  /** Crea una invitación de un solo uso y devuelve su enlace. */
  crearInvitacion(input: { creadaPor: string; nota: string; diasDeVida: number }): {
    id: string;
    enlace: string;
    expiraEn: number;
  } {
    const token = generateToken();
    const id = randomUUID();
    const expiresAt = this.now() + input.diasDeVida * DIA;

    this.repository.insertInvitation({
      id,
      tokenHash: hashToken(token),
      note: input.nota.trim(),
      createdBy: input.creadaPor,
      createdAt: this.now(),
      expiresAt,
      usedAt: null,
      usedBy: null,
    });

    // El enlace se devuelve UNA vez, aquí. El token solo se guarda hasheado, así
    // que ni el panel ni la base pueden volver a enseñarlo: si se pierde, se
    // crea otra invitación y ya está.
    return { id, enlace: `${this.publicWebUrl}/auth/registro?invitacion=${token}`, expiraEn: expiresAt };
  }

  listarInvitaciones(): {
    id: string;
    nota: string;
    creadaEn: number;
    expiraEn: number;
    usadaEn: number | null;
  }[] {
    return this.repository.listInvitations().map((fila) => ({
      id: fila.id,
      nota: fila.note,
      creadaEn: fila.createdAt,
      expiraEn: fila.expiresAt,
      usadaEn: fila.usedAt,
    }));
  }

  revocarInvitacion(id: string): void {
    this.repository.deleteInvitation(id);
  }

  /**
   * Verifica una cuenta con un token de un solo uso.
   *
   * Se marca usado dentro de la misma operación que activa la cuenta: un token
   * de verificación que sirva dos veces es un token que sirve para siempre.
   */
  verifyEmail(token: string): void {
    const record = this.consumeEmailToken(token, 'verify');
    this.activar(record.userId);
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

    // Si no hay cuenta se gasta el mismo tiempo igualmente: comprobar Argon2
    // con 19 MiB tarda lo suyo, y saltárselo hace que "no existe" se conteste
    // en un milisegundo. El mensaje sería idéntico y el cronómetro lo delataría.
    const ok = user
      ? await verifyPassword(user.passwordHash, input.password)
      : await wastePasswordTime(input.password).then(() => false);

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
    this.activar(record.userId);
    this.repository.updatePassword(record.userId, await hashPassword(password));
    this.repository.revokeAllForUser(record.userId, this.now());
  }

  /**
   * Pasa una cuenta a activa, si le corresponde.
   *
   * Es el único sitio del servicio que escribe `active`, y por eso puede
   * garantizar lo que importa: una cuenta bloqueada NO se desbloquea sola. Sin
   * esta comprobación, pedir un cambio de contraseña —o usar un enlace de
   * verificación viejo— sería una forma de levantarse el bloqueo uno mismo.
   */
  private activar(userId: string): void {
    const user = this.repository.findUserById(userId);
    if (!user) throw new AppError('token-invalido', 'El enlace no vale o ha caducado.');
    if (user.status === 'blocked') {
      throw new AppError('sin-permiso', 'Esta cuenta está bloqueada.');
    }
    if (user.status === 'pending') this.repository.updateUserStatus(userId, 'active');
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
      subject:
        purpose === 'verify'
          ? `Verifica tu cuenta de ${NOMBRE_DEL_SITIO}`
          : `Cambiar tu contraseña de ${NOMBRE_DEL_SITIO}`,
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
    role: user.role,
  };
}
