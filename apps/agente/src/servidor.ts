import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Type } from '@sinclair/typebox';
import { Almacen } from './almacen';
import type { Acceso } from './acceso';
import type { Buzon } from './buzon';
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
  /**
   * Con qué dispositivos se ha emparejado. Sin esto, el agente solo lee: no
   * hay canal al que escribir y las rutas de abajo no se registran.
   */
  readonly acceso?: Acceso;
  readonly buzon?: Buzon;
  /** Enseña el código de emparejamiento donde solo tú puedes verlo. */
  readonly mostrarCodigo?: (codigo: string, nombre: string) => void;
  /** En qué repositorio corre esta sesión, para distinguirla de las demás. */
  readonly proyecto?: string;
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
    methods: ['GET', 'POST'],
    allowedHeaders: ['authorization', 'content-type'],
  });

  /**
   * Solo se contesta a quien llama a esta máquina por su nombre de máquina.
   *
   * CORS no basta contra el ataque clásico a un servicio de `localhost`: una
   * web cualquiera apunta su propio dominio a 127.0.0.1, y entonces sus
   * peticiones son del mismo origen y ningún CORS las mira. Lo que no puede
   * falsificar es la cabecera `Host`, que seguirá diciendo su dominio.
   *
   * Esto es lo que hace que «escucha solo en local» signifique algo de verdad.
   */
  app.addHook('onRequest', async (peticion, respuesta) => {
    const host = (peticion.headers.host ?? '').split(':')[0].toLowerCase();
    if (host !== '127.0.0.1' && host !== 'localhost' && host !== '[::1]') {
      await respuesta.status(403).send({ code: 'host-raro', message: 'Aquí no se llama así' });
    }
  });

  const canal = opciones.acceso && opciones.buzon ? { acceso: opciones.acceso, buzon: opciones.buzon } : null;

  /**
   * Quién es y de qué proyecto.
   *
   * Con varios repositorios abiertos hay un canal por sesión, cada uno en su
   * puerto: la web los recorre y enseña esto para que elijas a cuál escribir.
   */
  app.get('/salud', () => ({
    agente: 'devweb',
    version: 1,
    canal: canal !== null,
    proyecto: opciones.proyecto ?? '',
  }));

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

  if (!canal) return app;

  // ===== EL CANAL: a partir de aquí se escribe, y hace falta estar emparejado =====

  const { acceso, buzon } = canal;

  /**
   * Quién llama.
   *
   * El token lo dio un emparejamiento hecho delante de este ordenador. Sin él
   * no se pasa de aquí: una cookie de administrador robada no vale, porque el
   * dispositivo tiene que haberse presentado una vez en persona.
   */
  const identificado = (peticion: { headers: Record<string, unknown> }): boolean => {
    const cabecera = peticion.headers['authorization'];
    const token = typeof cabecera === 'string' ? cabecera.replace(/^Bearer /, '') : '';
    return acceso.reconoce(token);
  };

  app.post(
    '/emparejar/empezar',
    { schema: { body: Type.Object({ nombre: Type.String({ maxLength: 40 }) }) } },
    async (request, reply) => {
      const codigo = acceso.empezarEmparejamiento(request.body.nombre);
      opciones.mostrarCodigo?.(codigo, request.body.nombre);
      // El código NO viaja en la respuesta: sale por el terminal, que es lo que
      // obliga a estar delante del ordenador una vez.
      await reply.send({ pedido: true });
    },
  );

  app.post(
    '/emparejar',
    { schema: { body: Type.Object({ codigo: Type.String({ minLength: 6, maxLength: 6 }) }) } },
    async (request, reply) => {
      const token = await acceso.emparejar(request.body.codigo);
      if (!token) {
        await reply.status(403).send({ code: 'codigo-invalido', message: 'Ese código no vale' });
        return;
      }
      await reply.send({ token });
    },
  );

  app.get('/dispositivos', async (request, reply) => {
    if (!identificado(request)) {
      await reply.status(401).send({ code: 'sin-emparejar', message: 'Este aparato no está dentro' });
      return;
    }
    await reply.send({
      dispositivos: acceso.dispositivos().map(({ id, nombre, desde }) => ({ id, nombre, desde })),
    });
  });

  app.post(
    '/mensaje',
    { schema: { body: Type.Object({ texto: Type.String({ minLength: 1, maxLength: 4000 }) }) } },
    async (request, reply) => {
      if (!identificado(request)) {
        await reply.status(401).send({ code: 'sin-emparejar', message: 'Este aparato no está dentro' });
        return;
      }
      buzon.escribir(request.body.texto);
      await reply.send({ enviado: true });
    },
  );

  app.get('/conversacion', async (request, reply) => {
    if (!identificado(request)) {
      await reply.status(401).send({ code: 'sin-emparejar', message: 'Este aparato no está dentro' });
      return;
    }
    await reply.send({ mensajes: buzon.conversacion(), permisos: buzon.pendientes() });
  });

  app.post(
    '/permisos/:id',
    {
      schema: {
        params: Type.Object({ id: Type.String({ minLength: 1, maxLength: 32 }) }),
        body: Type.Object({ veredicto: Type.Union([Type.Literal('allow'), Type.Literal('deny')]) }),
      },
    },
    async (request, reply) => {
      if (!identificado(request)) {
        await reply.status(401).send({ code: 'sin-emparejar', message: 'Este aparato no está dentro' });
        return;
      }
      const valio = buzon.decidir(request.params.id, request.body.veredicto);
      if (!valio) {
        await reply.status(409).send({ code: 'ya-no-toca', message: 'Eso ya está contestado' });
        return;
      }
      await reply.send({ hecho: true });
    },
  );

  return app;
}
