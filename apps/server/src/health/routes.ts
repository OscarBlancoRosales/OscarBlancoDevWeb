import { Type } from '@sinclair/typebox';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { Db } from '../db/index';

const HealthResponse = Type.Object({
  status: Type.Union([Type.Literal('ok'), Type.Literal('degradado')]),
  database: Type.Boolean(),
  uptimeSeconds: Type.Number(),
});

/**
 * Comprueba la base, no solo que el proceso conteste.
 *
 * Un `/health` que solo devuelve 200 porque hay un proceso vivo miente
 * exactamente cuando más falta hace la verdad: el día que el disco esté lleno y
 * SQLite no pueda escribir, el proceso sigue en pie y el servicio no funciona.
 */
export function healthRoutes(db: Db): FastifyPluginCallbackTypebox {
  return (app, _options, done) => {
    app.get(
      '/health',
      { schema: { response: { 200: HealthResponse, 503: HealthResponse } } },
      async (_request, reply) => {
        const database = isDatabaseAlive(db);
        await reply.status(database ? 200 : 503).send({
          status: database ? ('ok' as const) : ('degradado' as const),
          database,
          uptimeSeconds: Math.round(process.uptime()),
        });
      },
    );
    done();
  };
}

function isDatabaseAlive(db: Db): boolean {
  try {
    db.prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}
