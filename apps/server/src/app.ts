import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { Config } from './config';
import type { Db } from './db/index';
import { registerErrorHandler } from './errors';
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

  await app.register(healthRoutes(db));

  return app;
}
