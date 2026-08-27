import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { Config } from './config';
import type { Db } from './db/index';
import type { Mailer } from './auth/mailer';
import { registerErrorHandler } from './errors';
import { registerAuthGuard } from './auth/guard';
import { authRoutes } from './auth/routes';
import { AuthService } from './auth/service';
import { createAuthRepository } from './auth/repository';
import { createConsoleMailer, createSmtpMailer } from './auth/mailer';
import { healthRoutes } from './health/routes';

export interface BuildOptions {
  readonly config: Config;
  readonly db: Db;
}

/**
 * Construye la instancia sin escucharla.
 *
 * Separar construir de escuchar es lo que permite que un test levante el
 * servidor entero, le pegue una petición con `inject` y lo tire, sin abrir un
 * puerto ni esperar a nadie.
 */
export async function buildApp({ config, db }: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: 'info' },
    trustProxy: true,
    bodyLimit: 256 * 1024,
    // Fastify por defecto BORRA los campos no declarados en vez de
    // rechazarlos. Un cliente con una errata recibiría un 200 y su campo
    // desaparecería sin que nadie se enterase; y el día que un esquema se
    // quede corto, el silencio juega a favor de quien manda de más.
    ajv: { customOptions: { removeAdditional: false } },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(helmet, { contentSecurityPolicy: false });

  // Lista blanca explícita: sin comodines y sin reflejar el Origin recibido,
  // que con `credentials: true` equivale a no tener CORS.
  await app.register(cors, {
    origin: config.corsOrigins as string[],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    hook: 'onRequest',
  });

  registerErrorHandler(app);
  registerAuthGuard(app, config.JWT_SECRET);

  const service = new AuthService({
    repository: createAuthRepository(db),
    mailer: mailerFor(config, app.log.info.bind(app.log)),
    publicWebUrl: config.PUBLIC_WEB_URL,
    refreshTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
  });

  await app.register(healthRoutes(db));
  await app.register(authRoutes({ service, config }));

  return app;
}

/**
 * Sin relay configurado, el correo va al log.
 *
 * En desarrollo eso permite copiar el enlace de verificación del terminal sin
 * montar nada; en producción, `provision.sh` deja SMTP_URL puesto y este camino
 * no se toma.
 */
function mailerFor(config: Config, log: (message: string) => void): Mailer {
  return config.SMTP_URL === ''
    ? createConsoleMailer(log)
    : createSmtpMailer(config.SMTP_URL, config.MAIL_FROM);
}
