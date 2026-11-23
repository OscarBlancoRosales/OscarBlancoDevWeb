import { randomUUID } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import {
  CABECERA_PASE,
  CanjearCodigo,
  CrearInvitacionPrivada,
  InvitacionPrivada,
  ListaInvitacionesPrivadas,
  ListaPrivada,
  PasePrivado,
  PedirDocumento,
  RUTA_PRIVADA,
} from '@devweb/shared/contracts/privado';
import { AppError } from '../errors';
import { generateToken, hashToken, signPayload, verifyPayload } from '../auth/tokens';
import type { DocumentoPrivado } from '@devweb/shared/contracts/privado';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { FastifyRequest, onRequestHookHandler } from 'fastify';
import type { Db } from '../db/index';

/** Lo que dura una invitación sin canjear, y el pase que da al canjearla. */
export const VIDA_INVITACION_MS = 60 * 60 * 1000;

const LIMITE_CANJE = { max: 10, timeWindow: '5 minutes' } as const;
const PATRON = new RegExp(RUTA_PRIVADA);

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_GRUPO_DE_SERIE = 7;

interface Pase {
  readonly tipo: 'pase-privado';
  /** De qué invitación sale: revocarla lo mata aunque su firma siga valiendo. */
  readonly inv: string;
  readonly expiresAt: number;
}

const esPase = (valor: unknown): valor is Pase =>
  typeof valor === 'object' &&
  valor !== null &&
  (valor as { tipo?: unknown }).tipo === 'pase-privado' &&
  typeof (valor as { inv?: unknown }).inv === 'string' &&
  typeof (valor as { expiresAt?: unknown }).expiresAt === 'number';

const InvitacionParams = Type.Object({ id: Type.String({ minLength: 1, maxLength: 64 }) });

interface FilaInvitacion {
  id: string;
  tipo: 'una' | 'grupo';
  nota: string;
  creada_en: number;
  caduca: number;
  canjes: number;
  revocada_en: number | null;
}

export interface OpcionesPrivado {
  readonly db: Db;
  readonly carpeta: string;
  readonly secreto: string;
  readonly ahora?: () => number;
}

/**
 * Lo privado: la lista, cada documento, y las invitaciones de un solo uso.
 *
 * Ver exige ser administrador o traer un pase; invitar, solo administrador. Un
 * pase no es una sesión: no sirve para nada más que para leer esta carpeta, y
 * caduca con la invitación de la que salió.
 */
export function privadoRoutes(opciones: OpcionesPrivado): FastifyPluginCallbackTypebox {
  const { db, secreto } = opciones;
  const carpeta = resolve(opciones.carpeta);
  const ahora = opciones.ahora ?? Date.now;

  return (app, _options, done) => {
    const conPaseOAdmin: onRequestHookHandler = function (request, reply, siguiente) {
      if (paseValido(request)) {
        siguiente();
        return;
      }
      app.requireAdmin.call(this, request, reply, siguiente);
    };

    const paseValido = (request: FastifyRequest): boolean => {
      const cabecera = request.headers[CABECERA_PASE];
      if (typeof cabecera !== 'string') return false;
      const pase = verifyPayload(cabecera, secreto, esPase, ahora());
      if (pase === null) return false;
      const viva = db
        .prepare('SELECT 1 FROM invitaciones_privado WHERE id = ? AND revocada_en IS NULL')
        .get(pase.inv);
      return viva !== undefined;
    };

    app.get(
      '/privado',
      { onRequest: conPaseOAdmin, schema: { response: { 200: ListaPrivada } } },
      async (_request, reply) => {
        await reply.send({ documentos: await listar(carpeta) });
      },
    );

    app.get(
      '/privado/documento',
      { onRequest: conPaseOAdmin, schema: { querystring: PedirDocumento } },
      async (request, reply) => {
        const destino = resolve(carpeta, request.query.ruta);
        // El patrón ya no deja pasar «..», pero lo que manda es dónde cae de verdad.
        if (!destino.startsWith(carpeta + sep)) throw new AppError('no-encontrado', 'No existe.');
        const html = await readFile(destino, 'utf8').catch(() => {
          throw new AppError('no-encontrado', 'No existe.');
        });
        await reply
          .header('content-type', 'text/html; charset=utf-8')
          .header('cache-control', 'no-store')
          .send(html);
      },
    );

    app.post(
      '/privado/invitaciones',
      {
        onRequest: app.requireAdmin,
        schema: { body: CrearInvitacionPrivada, response: { 200: InvitacionPrivada } },
      },
      async (request, reply) => {
        const tipo = request.body.tipo ?? 'una';
        const codigo = generateToken().slice(0, 12);
        const creada = ahora();
        const caduca =
          creada +
          (tipo === 'grupo' ? (request.body.dias ?? DIAS_GRUPO_DE_SERIE) * DIA_MS : VIDA_INVITACION_MS);
        const id = randomUUID();
        db.prepare(
          `INSERT INTO invitaciones_privado (id, codigo_hash, creada_por, creada_en, caduca, tipo, nota)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(id, hashToken(codigo), request.userId, creada, caduca, tipo, request.body.nota ?? '');
        await reply.send({ id, codigo, caduca });
      },
    );

    app.get(
      '/privado/invitaciones',
      { onRequest: app.requireAdmin, schema: { response: { 200: ListaInvitacionesPrivadas } } },
      async (_request, reply) => {
        const filas = db
          .prepare(
            `SELECT id, tipo, nota, creada_en, caduca, canjes, revocada_en
             FROM invitaciones_privado ORDER BY creada_en DESC LIMIT 100`,
          )
          .all() as FilaInvitacion[];
        await reply.send({
          invitaciones: filas.map((f) => ({
            id: f.id,
            tipo: f.tipo,
            nota: f.nota,
            creada: f.creada_en,
            caduca: f.caduca,
            canjes: f.canjes,
            revocada: f.revocada_en !== null,
          })),
        });
      },
    );

    app.delete(
      '/privado/invitaciones/:id',
      { onRequest: app.requireAdmin, schema: { params: InvitacionParams } },
      async (request, reply) => {
        const hecho = db
          .prepare('UPDATE invitaciones_privado SET revocada_en = ? WHERE id = ? AND revocada_en IS NULL')
          .run(ahora(), request.params.id);
        if (hecho.changes === 0) throw new AppError('no-encontrado', 'No existe.');
        await reply.send({ ok: true });
      },
    );

    app.post(
      '/privado/canjear',
      {
        config: { rateLimit: LIMITE_CANJE },
        schema: { body: CanjearCodigo, response: { 200: PasePrivado } },
      },
      async (request, reply) => {
        const momento = ahora();
        // Gastarla y comprobarla en la misma sentencia: dos canjes a la vez no
        // pueden llevarse la misma invitación de un uso. La de grupo no se gasta:
        // solo cuenta la entrada.
        const fila = db
          .prepare(
            `UPDATE invitaciones_privado
             SET canjeada_en = coalesce(canjeada_en, ?), canjes = canjes + 1
             WHERE codigo_hash = ? AND caduca > ? AND revocada_en IS NULL
               AND (tipo = 'grupo' OR canjeada_en IS NULL)
             RETURNING id, caduca`,
          )
          .get(momento, hashToken(request.body.codigo.trim()), momento) as
          | { id: string; caduca: number }
          | undefined;
        if (fila === undefined) {
          throw new AppError('invitacion-invalida', 'El código no vale: ya se usó o ha caducado.');
        }
        const pase = signPayload(
          { tipo: 'pase-privado', inv: fila.id, expiresAt: fila.caduca },
          secreto,
        );
        await reply.send({ pase, caduca: fila.caduca });
      },
    );

    done();
  };
}

async function listar(carpeta: string): Promise<DocumentoPrivado[]> {
  const entradas = await readdir(carpeta, { recursive: true, withFileTypes: true }).catch(
    () => [],
  );
  const documentos: DocumentoPrivado[] = [];
  for (const entrada of entradas) {
    if (!entrada.isFile()) continue;
    const ruta = relative(carpeta, join(entrada.parentPath, entrada.name)).split(sep).join('/');
    if (!PATRON.test(ruta)) continue;
    const html = await readFile(join(carpeta, ruta), 'utf8');
    const titulo = /<title>([^<]{1,300})<\/title>/i.exec(html)?.[1]?.trim() ?? ruta;
    const grupo = ruta.includes('/') ? (ruta.split('/')[0] ?? '') : '';
    documentos.push({ ruta, titulo, grupo });
  }
  return documentos.sort((a, b) => a.ruta.localeCompare(b.ruta)).slice(0, 500);
}
