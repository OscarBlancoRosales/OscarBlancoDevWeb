import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Type } from '@sinclair/typebox';
import { Almacen } from './almacen';
import { ListaDeSesiones, Sesion } from '@devweb/shared/contracts/sesiones';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

/**
 * El agente: lo único de toda la casa que corre en tu ordenador.
 *
 * Sirve tus sesiones de Claude Code a la pantalla de administración. Escucha
 * **solo en 127.0.0.1**, así que no hay nada que alcanzar desde fuera aunque
 * alguien dé con tu IP: la web habla con él desde tu propio navegador, y solo
 * mientras tú lo tengas arrancado. Cerrar la ventana es cerrar la puerta.
 *
 * De momento solo lee. Escribir —pedirle cosas a Claude desde la web— es el
 * paso siguiente, y trae sus propias preguntas: ahí quien pueda escribir por
 * aquí manda sobre tu sesión.
 */

export interface OpcionesDelAgente {
  readonly almacen?: Almacen;
  /** Desde dónde se acepta que llamen. La web, y el desarrollo en local. */
  readonly origenes?: readonly string[];
}

const ORIGENES_POR_DEFECTO = [
  'https://oscarblancorosales.com',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
];

const Params = Type.Object({ id: Type.String({ minLength: 1, maxLength: 120 }) });
const NoExiste = Type.Object({ code: Type.String(), message: Type.String() });
const Query = Type.Object({
  desde: Type.Integer({ minimum: 0, default: 0 }),
  cuantas: Type.Integer({ minimum: 1, maximum: 200, default: 60 }),
});

export async function construirAgente(opciones: OpcionesDelAgente = {}): Promise<FastifyInstance> {
  const almacen = opciones.almacen ?? new Almacen();
  const app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();

  // Lista blanca, sin comodín: cualquier página que abras podría hablar con
  // este puerto, y lo que hay detrás es el historial de todo lo que trabajas.
  await app.register(cors, {
    origin: [...(opciones.origenes ?? ORIGENES_POR_DEFECTO)],
    methods: ['GET'],
  });

  app.get('/salud', () => ({ agente: 'devweb', version: 1 }));

  app.get('/sesiones', { schema: { response: { 200: ListaDeSesiones } } }, async (_req, reply) => {
    await reply.send({ sesiones: await almacen.listar() });
  });

  app.get(
    '/sesiones/:id',
    { schema: { params: Params, querystring: Query, response: { 200: Sesion, 404: NoExiste } } },
    async (request, reply) => {
      const { desde, cuantas } = request.query;
      const sesion = await almacen.abrir(request.params.id, desde, cuantas);
      if (!sesion) {
        await reply.status(404).send({ code: 'no-existe', message: 'Esa sesión no está aquí' });
        return;
      }
      await reply.send(sesion);
    },
  );

  return app;
}
