import { Type } from '@sinclair/typebox';
import { OkResponse } from '@devweb/shared/contracts/auth';
import { AppError } from '../errors';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { Db } from '../db/index';

const Nombre = Type.String({ minLength: 1, maxLength: 64, pattern: '^[a-z0-9-]+$' });

const Params = Type.Object({ namespace: Nombre, key: Nombre });

const Entrada = Type.Object({
  key: Type.String(),
  value: Type.Unknown(),
  updatedAt: Type.Integer(),
});

const Guardar = Type.Object({ value: Type.Unknown() }, { additionalProperties: false });

const Listado = Type.Object({ entries: Type.Array(Entrada) });

interface Fila {
  key: string;
  value_json: string;
  updated_at: number;
  owner_id: string | null;
}

/**
 * Un almacén de clave y valor con dueño.
 *
 * Es lo que hoy cuelga de `throwdown-timer/configs` en Firebase, donde las
 * reglas dicen `.write: true` y por tanto cualquiera puede reescribir la
 * configuración de cualquiera. Aquí escribir exige cuenta y solo el dueño puede
 * sobrescribir lo suyo; leer sigue siendo público, porque las configuraciones se
 * comparten por enlace.
 */
export function kvRoutes(db: Db): FastifyPluginCallbackTypebox {
  const consultas = {
    leer: db.prepare('SELECT key, value_json, updated_at, owner_id FROM kv WHERE namespace = ? AND key = ?'),
    listarDe: db.prepare(
      'SELECT key, value_json, updated_at, owner_id FROM kv WHERE namespace = ? AND owner_id = ? ORDER BY updated_at DESC',
    ),
    guardar: db.prepare(
      'INSERT INTO kv (namespace, key, owner_id, value_json, updated_at) VALUES (?, ?, ?, ?, ?)' +
        ' ON CONFLICT (namespace, key) DO UPDATE SET value_json = excluded.value_json,' +
        ' updated_at = excluded.updated_at',
    ),
    borrar: db.prepare('DELETE FROM kv WHERE namespace = ? AND key = ?'),
  };

  const dueñoDe = (namespace: string, key: string): Fila | null =>
    (consultas.leer.get(namespace, key) as Fila | undefined) ?? null;

  return (app, _options, done) => {
    app.get(
      '/kv/:namespace/:key',
      { schema: { params: Params, response: { 200: Entrada } } },
      async (request, reply) => {
        const fila = dueñoDe(request.params.namespace, request.params.key);
        if (!fila) throw new AppError('no-encontrado', 'No hay nada guardado con esa clave.');

        await reply.send({
          key: fila.key,
          value: JSON.parse(fila.value_json) as unknown,
          updatedAt: fila.updated_at,
        });
      },
    );

    app.get(
      '/kv/:namespace',
      {
        onRequest: app.requireUser,
        schema: { params: Type.Object({ namespace: Nombre }), response: { 200: Listado } },
      },
      async (request, reply) => {
        const filas = consultas.listarDe.all(request.params.namespace, request.userId) as Fila[];
        await reply.send({
          entries: filas.map((fila) => ({
            key: fila.key,
            value: JSON.parse(fila.value_json) as unknown,
            updatedAt: fila.updated_at,
          })),
        });
      },
    );

    app.put(
      '/kv/:namespace/:key',
      {
        onRequest: app.requireUser,
        schema: { params: Params, body: Guardar, response: { 200: OkResponse } },
      },
      async (request, reply) => {
        const { namespace, key } = request.params;
        const existente = dueñoDe(namespace, key);
        if (existente && existente.owner_id !== request.userId) {
          throw new AppError('sin-permiso', 'Eso lo guardó otra persona.');
        }

        consultas.guardar.run(
          namespace,
          key,
          request.userId,
          JSON.stringify(request.body.value),
          Date.now(),
        );
        await reply.send({ ok: true });
      },
    );

    app.delete(
      '/kv/:namespace/:key',
      { onRequest: app.requireUser, schema: { params: Params, response: { 200: OkResponse } } },
      async (request, reply) => {
        const { namespace, key } = request.params;
        const existente = dueñoDe(namespace, key);
        if (!existente) throw new AppError('no-encontrado', 'No hay nada guardado con esa clave.');
        if (existente.owner_id !== request.userId) {
          throw new AppError('sin-permiso', 'Eso lo guardó otra persona.');
        }

        consultas.borrar.run(namespace, key);
        await reply.send({ ok: true });
      },
    );

    done();
  };
}
