import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { openDatabase } from '../db/index';
import { createAuthRepository } from './repository';
import { AuthService } from './service';
import type { Db } from '../db/index';
import type { Mail, Mailer } from './mailer';

const ALTA = { email: 'Oscar@Example.com', password: 'contraseña-larga-1', displayName: 'Óscar' };
const CLIENTE = { ip: '127.0.0.1', userAgent: 'vitest' };

/** Un buzón de mentira que guarda lo enviado, para poder leer el enlace. */
function buzon(): Mailer & { enviados: Mail[] } {
  const enviados: Mail[] = [];
  return {
    enviados,
    send(mail) {
      enviados.push(mail);
      return Promise.resolve();
    },
  };
}

function tokenDe(mail: Mail): string {
  const match = /token=([\w-]+)/.exec(mail.text);
  if (!match?.[1]) throw new Error(`Sin token en el correo:\n${mail.text}`);
  return match[1];
}

describe('AuthService', () => {
  let db: Db;
  let correo: ReturnType<typeof buzon>;
  let ahora: number;
  let auth: AuthService;

  beforeEach(() => {
    db = openDatabase(':memory:');
    correo = buzon();
    ahora = 1_700_000_000_000;
    auth = new AuthService({
      repository: createAuthRepository(db),
      mailer: correo,
      publicWebUrl: 'https://oscarblancorosales.com/',
      refreshTtlDays: 30,
      now: () => ahora,
    });
  });

  async function altaVerificada(): Promise<void> {
    await auth.register(ALTA);
    auth.verifyEmail(tokenDe(correo.enviados[0]));
  }

  describe('registro', () => {
    it('manda el correo de verificación', async () => {
      await auth.register(ALTA);

      expect(correo.enviados).toHaveLength(1);
      expect(correo.enviados[0]?.to).toBe('oscar@example.com');
      expect(correo.enviados[0]?.text).toContain('https://oscarblancorosales.com/auth/verificar?token=');
    });

    it('no delata que un correo ya tiene cuenta', async () => {
      await auth.register(ALTA);

      // No lanza: contestar distinto convertiría el alta en un comprobador de
      // cuentas registradas.
      await expect(auth.register({ ...ALTA, email: 'OSCAR@EXAMPLE.COM' })).resolves.toBeUndefined();

      // Y no se ha creado una segunda cuenta con el mismo correo.
      const cuentas = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
      expect(cuentas.n).toBe(1);
    });

    it('avisa al dueño de la cuenta del intento, que es quien debe enterarse', async () => {
      await auth.register(ALTA);
      await auth.register({ ...ALTA, email: 'OSCAR@EXAMPLE.COM' });

      expect(correo.enviados).toHaveLength(2);
      expect(correo.enviados[1]?.subject).toContain('intentado registrarse');
      expect(correo.enviados[1]?.to).toBe('oscar@example.com');
    });

    it('el aviso del intento no lleva ningún enlace con token', () => {
      expect(correo.enviados.every((mail) => !mail.text.includes('token='))).toBe(true);
    });

    it('la cuenta nace sin verificar y no deja entrar', async () => {
      await auth.register(ALTA);

      await expect(auth.login(ALTA, CLIENTE)).rejects.toMatchObject({
        code: 'cuenta-sin-verificar',
      });
    });

    it('no guarda la contraseña, sino su hash de Argon2', async () => {
      await auth.register(ALTA);

      const fila = db.prepare('SELECT password_hash FROM users').get() as { password_hash: string };
      expect(fila.password_hash).not.toContain(ALTA.password);
      expect(fila.password_hash.startsWith('$argon2id$')).toBe(true);
    });
  });

  describe('verificación', () => {
    it('activa la cuenta y ya deja entrar', async () => {
      await altaVerificada();

      const sesion = await auth.login(ALTA, CLIENTE);
      expect(sesion.user.status).toBe('active');
    });

    it('el token no sirve dos veces', async () => {
      await auth.register(ALTA);
      const token = tokenDe(correo.enviados[0]);
      auth.verifyEmail(token);

      expect(() => { auth.verifyEmail(token); }).toThrow(AppError);
    });

    it('el token caduca a las 24 horas', async () => {
      await auth.register(ALTA);
      const token = tokenDe(correo.enviados[0]);
      ahora += 25 * 60 * 60 * 1000;

      expect(() => { auth.verifyEmail(token); }).toThrow(AppError);
    });

    it('un token de cambio de contraseña no vale para verificar', async () => {
      await altaVerificada();
      await auth.requestPasswordReset(ALTA.email);
      const tokenDeCambio = tokenDe(correo.enviados[1]);

      expect(() => { auth.verifyEmail(tokenDeCambio); }).toThrow(AppError);
    });
  });

  describe('acceso', () => {
    it('no distingue correo inexistente de contraseña equivocada', async () => {
      await altaVerificada();

      const inexistente = await auth.login({ email: 'nadie@example.com', password: ALTA.password }, CLIENTE).catch((e: unknown) => e);
      const equivocada = await auth.login({ email: ALTA.email, password: 'otra-contraseña-1' }, CLIENTE).catch((e: unknown) => e);

      expect((inexistente as AppError).code).toBe('credenciales-invalidas');
      expect((equivocada as AppError).code).toBe('credenciales-invalidas');
      expect((inexistente as AppError).message).toBe((equivocada as AppError).message);
    });

    it('una cuenta bloqueada no entra aunque acierte la contraseña', async () => {
      await altaVerificada();
      db.prepare("UPDATE users SET status = 'blocked'").run();

      await expect(auth.login(ALTA, CLIENTE)).rejects.toMatchObject({ code: 'sin-permiso' });
    });

    it('guarda el token de refresco hasheado, nunca en claro', async () => {
      await altaVerificada();
      const sesion = await auth.login(ALTA, CLIENTE);

      const fila = db.prepare('SELECT token_hash FROM sessions').get() as { token_hash: string };
      expect(fila.token_hash).not.toBe(sesion.refreshToken);
      expect(fila.token_hash).toHaveLength(64);
    });
  });

  describe('refresco con rotación', () => {
    it('cada refresco entrega un token nuevo', async () => {
      await altaVerificada();
      const primera = await auth.login(ALTA, CLIENTE);

      const segunda = auth.refresh(primera.refreshToken, CLIENTE);

      expect(segunda.refreshToken).not.toBe(primera.refreshToken);
    });

    it('el token anterior deja de valer en cuanto se usa', async () => {
      await altaVerificada();
      const primera = await auth.login(ALTA, CLIENTE);
      auth.refresh(primera.refreshToken, CLIENTE);

      expect(() => auth.refresh(primera.refreshToken, CLIENTE)).toThrow(AppError);
    });

    it('reusar un token gastado mata la cadena entera, también la del ladrón', async () => {
      await altaVerificada();
      const primera = await auth.login(ALTA, CLIENTE);
      const segunda = auth.refresh(primera.refreshToken, CLIENTE);

      // El ladrón se quedó con el primero y lo usa: eso delata el robo.
      expect(() => auth.refresh(primera.refreshToken, CLIENTE)).toThrow(AppError);

      // Y la sesión legítima, que iba por el segundo, también se cae.
      expect(() => auth.refresh(segunda.refreshToken, CLIENTE)).toThrow(AppError);
    });

    it('un token caducado no renueva', async () => {
      await altaVerificada();
      const sesion = await auth.login(ALTA, CLIENTE);
      ahora += 31 * 24 * 60 * 60 * 1000;

      expect(() => auth.refresh(sesion.refreshToken, CLIENTE)).toThrow(AppError);
    });

    it('un token inventado no renueva', async () => {
      await altaVerificada();

      expect(() => auth.refresh('me-lo-acabo-de-inventar', CLIENTE)).toThrow(AppError);
    });
  });

  describe('salir', () => {
    it('cierra la sesión de verdad', async () => {
      await altaVerificada();
      const sesion = await auth.login(ALTA, CLIENTE);

      auth.logout(sesion.refreshToken);

      expect(() => auth.refresh(sesion.refreshToken, CLIENTE)).toThrow(AppError);
    });

    it('salir con un token que no existe no revienta', () => {
      expect(() => { auth.logout('cualquier-cosa'); }).not.toThrow();
    });
  });

  describe('cambio de contraseña', () => {
    it('no delata si el correo está registrado o no', async () => {
      await expect(auth.requestPasswordReset('nadie@example.com')).resolves.toBeUndefined();
      expect(correo.enviados).toHaveLength(0);
    });

    it('cambia la contraseña y la nueva es la que entra', async () => {
      await altaVerificada();
      await auth.requestPasswordReset(ALTA.email);

      await auth.resetPassword(tokenDe(correo.enviados[1]), 'una-contraseña-nueva-1');

      await expect(auth.login(ALTA, CLIENTE)).rejects.toMatchObject({ code: 'credenciales-invalidas' });
      const sesion = await auth.login({ email: ALTA.email, password: 'una-contraseña-nueva-1' }, CLIENTE);
      expect(sesion.user.email).toBe('oscar@example.com');
    });

    it('tira todas las sesiones abiertas, que es de lo que se trata', async () => {
      await altaVerificada();
      const abierta = await auth.login(ALTA, CLIENTE);
      await auth.requestPasswordReset(ALTA.email);

      await auth.resetPassword(tokenDe(correo.enviados[1]), 'una-contraseña-nueva-1');

      expect(() => auth.refresh(abierta.refreshToken, CLIENTE)).toThrow(AppError);
    });

    it('pedirlo dos veces invalida el primer enlace', async () => {
      await altaVerificada();
      await auth.requestPasswordReset(ALTA.email);
      const primero = tokenDe(correo.enviados[1]);
      await auth.requestPasswordReset(ALTA.email);

      await expect(auth.resetPassword(primero, 'una-contraseña-nueva-1')).rejects.toThrow(AppError);
    });
  });
});

describe('una cuenta bloqueada sigue bloqueada', () => {
  let db: Db;
  let correo: ReturnType<typeof buzon>;
  let auth: AuthService;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    correo = buzon();
    auth = new AuthService({
      repository: createAuthRepository(db),
      mailer: correo,
      publicWebUrl: 'https://oscarblancorosales.com',
      refreshTtlDays: 30,
    });
    await auth.register(ALTA);
    auth.verifyEmail(tokenDe(correo.enviados[0]));
    db.prepare("UPDATE users SET status = 'blocked'").run();
  });

  it('no se desbloquea cambiando la contraseña', async () => {
    await auth.requestPasswordReset(ALTA.email);
    const token = tokenDe(correo.enviados[1]);

    await expect(auth.resetPassword(token, 'una-contraseña-nueva-1')).rejects.toMatchObject({
      code: 'sin-permiso',
    });

    const fila = db.prepare('SELECT status FROM users').get() as { status: string };
    expect(fila.status).toBe('blocked');
  });

  it('y tampoco cambia la contraseña por el camino', async () => {
    const antes = (db.prepare('SELECT password_hash AS h FROM users').get() as { h: string }).h;
    await auth.requestPasswordReset(ALTA.email);

    await auth
      .resetPassword(tokenDe(correo.enviados[1]), 'una-contraseña-nueva-1')
      .catch(() => undefined);

    const despues = (db.prepare('SELECT password_hash AS h FROM users').get() as { h: string }).h;
    expect(despues).toBe(antes);
  });

  it('no se desbloquea con un enlace de verificación viejo', async () => {
    db.prepare("UPDATE users SET status = 'pending'").run();
    await auth.register({ ...ALTA, email: 'otro@example.com', displayName: 'Otro' });
    db.prepare("UPDATE users SET status = 'blocked' WHERE email = 'oscar@example.com'").run();

    await auth.requestPasswordReset(ALTA.email);

    await expect(
      auth.resetPassword(tokenDe(correo.enviados[correo.enviados.length - 1]), 'otra-larga-1'),
    ).rejects.toMatchObject({ code: 'sin-permiso' });
  });
});

describe('el tiempo de respuesta no cuenta si la cuenta existe', () => {
  it('tarda parecido con cuenta y sin cuenta', async () => {
    const db = openDatabase(':memory:');
    const auth = new AuthService({
      repository: createAuthRepository(db),
      mailer: buzon(),
      publicWebUrl: 'https://oscarblancorosales.com',
      refreshTtlDays: 30,
    });
    await auth.register(ALTA);
    db.prepare("UPDATE users SET status = 'active'").run();

    const medir = async (email: string): Promise<number> => {
      const inicio = performance.now();
      await auth.login({ email, password: 'contraseña-equivocada-1' }, CLIENTE).catch(() => undefined);
      return performance.now() - inicio;
    };

    // Se calientan las dos rutas antes de medir: el señuelo se calcula una vez.
    await medir(ALTA.email);
    await medir('nadie@example.com');

    const conCuenta = await medir(ALTA.email);
    const sinCuenta = await medir('nadie@example.com');

    // Que la ruta sin cuenta cueste tiempo de verdad es la mitad del arreglo:
    // si ambas fueran instantáneas, la proporción saldría bien y no probaría nada.
    expect(sinCuenta).toBeGreaterThan(5);
    expect(conCuenta).toBeGreaterThan(5);

    // Sin el señuelo, "sin cuenta" tardaría casi cero frente a decenas de
    // milisegundos: la diferencia sería de un orden de magnitud, no de un 30 %.
    expect(Math.max(conCuenta, sinCuenta) / Math.min(conCuenta, sinCuenta)).toBeLessThan(4);

    db.close();
  });
});
