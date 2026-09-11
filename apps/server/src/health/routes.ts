import { Type } from '@sinclair/typebox';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { Db } from '../db/index';
import type { AiSettings } from '@devweb/shared/engine/ai/ai-client';

const HealthResponse = Type.Object({
  status: Type.Union([Type.Literal('ok'), Type.Literal('degradado')]),
  database: Type.Boolean(),
  uptimeSeconds: Type.Number(),
  /**
   * Si el presentador y el crupier pueden hablar con un modelo.
   *
   * No es un adorno: sin esto, «la clave está puesta pero no improvisa» es
   * imposible de diagnosticar desde fuera, porque el juego funciona igual con
   * el guion escrito y no se queja de nada. Dice si hay clave y con qué
   * modelo, nunca la clave.
   */
  ia: Type.Object({
    configurada: Type.Boolean(),
    /**
     * Si además el presentador improvisa sus frases con el modelo.
     *
     * Son dos cosas distintas y conviene no confundirlas: «hay clave» es lo que
     * decide si se pueden inventar las preguntas de una sala, y eso es lo que
     * mira el lóbby. Que el presentador improvise viene apagado porque se come
     * la cuota del día en frases de relleno.
     */
    presentador: Type.Boolean(),
    proveedor: Type.String(),
    modelo: Type.String(),
    soloGratis: Type.Boolean(),
  }),
  /**
   * Si hay relay de correo puesto.
   *
   * Sin él, el registro contesta que todo ha ido bien y el enlace de
   * verificación acaba en el journal: quien se acaba de dar de alta espera un
   * correo que nunca sale. Es el mismo agujero que el de la IA —funciona
   * distinto sin quejarse— y se destapa igual, desde fuera y sin entrar en la
   * máquina. Dice si hay relay, nunca cuál ni con qué clave.
   */
  correo: Type.Object({ configurado: Type.Boolean() }),
});

/**
 * Comprueba la base, no solo que el proceso conteste.
 *
 * Un `/health` que solo devuelve 200 porque hay un proceso vivo miente
 * exactamente cuando más falta hace la verdad: el día que el disco esté lleno y
 * SQLite no pueda escribir, el proceso sigue en pie y el servicio no funciona.
 */
export function healthRoutes(
  db: Db,
  ia?: AiSettings | null,
  correoConfigurado = false,
): FastifyPluginCallbackTypebox {
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
          ia: {
            configurada: !!ia,
            presentador: !!ia?.enabled,
            proveedor: ia?.provider ?? '',
            modelo: ia?.model ?? '(los gratuitos por defecto)',
            soloGratis: ia?.freeOnly !== false,
          },
          correo: { configurado: correoConfigurado },
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
