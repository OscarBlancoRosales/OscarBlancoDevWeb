import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { Acceso } from './acceso';
import { Buzon } from './buzon';
import { construirAgente } from './servidor';

/**
 * El canal: la web le habla a tu sesión de Claude Code.
 *
 * Este proceso lo arranca Claude Code, no tú. Hace dos cosas a la vez: habla
 * con la sesión por la entrada estándar (que es como funciona MCP) y levanta
 * el mismo servidor local del visor, ahora con las rutas para escribir.
 *
 * La frontera está en el emparejamiento. El código sale por el terminal de
 * Claude Code —donde solo puede leerlo quien está delante del ordenador— y a
 * partir de ahí ese dispositivo entra siempre.
 *
 * Se declara el relé de permisos porque el remitente está autenticado. Sin esa
 * comprobación no habría que declararlo: quien pueda responder por aquí puede
 * aprobar lo que Claude quiera hacer en tu máquina.
 */

/**
 * El primero de los puertos, y cuántos se prueban.
 *
 * Un canal por sesión de Claude Code, y se tiene más de una abierta: una por
 * repositorio. Cada uno coge el primer hueco libre y la web los va buscando
 * por ahí, así que trabajar en dos proyectos a la vez no exige configurar
 * nada — y el emparejamiento vale para todos, porque la lista de aparatos es
 * una sola y vive en tu carpeta de usuario.
 */
const PUERTO_BASE = Number(process.env['PUERTO'] ?? 4319);
const CUANTOS_PUERTOS = 5;

const CARPETA = join(homedir(), '.claude', 'devweb-canal');
const FICHERO_DE_ACCESO = join(CARPETA, 'access.json');

/** El último código pedido, por si la sesión está a otra cosa y se pierde. */
const FICHERO_DEL_CODIGO = join(CARPETA, 'ultimo-codigo.txt');

/** Lo que Claude Code manda cuando se abre un diálogo de permiso. */
const PeticionDePermiso = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string(),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string(),
  }),
});

export async function arrancarCanal(): Promise<void> {
  // `Server` y no `McpServer`: la API de alto nivel no deja declarar
  // capacidades experimentales ni mandar notificaciones sueltas, que es
  // justo lo que hace falta para ser un canal.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const mcp = new Server(
    { name: 'devweb', version: '1.0.0' },
    {
      capabilities: {
        experimental: {
          'claude/channel': {},
          // El remitente está autenticado por emparejamiento: por eso, y solo
          // por eso, se pide que los permisos lleguen también aquí.
          'claude/channel/permission': {},
        },
        tools: {},
      },
      instructions:
        'Los mensajes de <channel source="devweb"> vienen de Óscar, desde el panel de ' +
        'administración de su web. Son peticiones de trabajo como las que escribiría en ' +
        'la terminal. Contesta llamando a la herramienta `responder` con un resumen corto ' +
        'de lo que has hecho o de lo que necesitas saber: lo lee en el móvil, así que ' +
        'una o dos frases, sin volcados largos.',
    },
  );

  await mkdir(CARPETA, { recursive: true });
  const acceso = new Acceso(FICHERO_DE_ACCESO);
  await acceso.cargar();

  const buzon = new Buzon(
    (texto) => {
      void mcp.notification({
        method: 'notifications/claude/channel',
        params: { content: texto, meta: { source: 'devweb', from: 'panel' } },
      });
    },
    (id, veredicto) => {
      void mcp.notification({
        method: 'notifications/claude/channel/permission',
        params: { request_id: id, behavior: veredicto },
      });
    },
  );

  // Lo que Claude contesta vuelve a la web por aquí.
  mcp.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: 'responder',
        description: 'Contesta al panel de administración de la web, donde Óscar lo lee.',
        inputSchema: {
          type: 'object',
          properties: {
            texto: { type: 'string', description: 'Lo que quieres decirle. Corto: lo lee en el móvil.' },
          },
          required: ['texto'],
        },
      },
    ],
  }));

  mcp.setRequestHandler(CallToolRequestSchema, (peticion) => {
    if (peticion.params.name !== 'responder') {
      throw new Error(`Esa herramienta no existe: ${peticion.params.name}`);
    }
    const { texto } = peticion.params.arguments as { texto: string };
    buzon.responder(texto);
    return { content: [{ type: 'text' as const, text: 'dicho' }] };
  });

  // Los permisos que Claude pide, para poder contestarlos desde el móvil. El
  // diálogo del terminal sigue abierto: vale el primero que conteste.
  mcp.setNotificationHandler(PeticionDePermiso, ({ params }) => {
    buzon.pedirPermiso({
      id: params.request_id,
      herramienta: params.tool_name,
      descripcion: params.description,
      detalle: params.input_preview,
    });
  });

  await mcp.connect(new StdioServerTransport());

  const app = await construirAgente({
    acceso,
    buzon,
    proyecto: basename(process.cwd()),
    // Para llegar desde el móvil por una red privada hay que decir por qué
    // nombre se va a llamar: HOSTS_DEL_CANAL=mi-pc.tu-tailnet.ts.net
    hosts: (process.env['HOSTS_DEL_CANAL'] ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter((h) => h !== ''),
    /**
     * Enseñar el código donde de verdad se está mirando.
     *
     * La salida de error de un servidor MCP no aparece en pantalla: Claude Code
     * se la queda. Escribirlo ahí era escribirlo en un cajón. Así que el código
     * entra en la conversación como un mensaje más del canal, y además queda en
     * un fichero por si la sesión está ocupada en otra cosa.
     *
     * Sigue sin viajar por la red, que era el punto: para leerlo hay que estar
     * delante de este ordenador.
     */
    mostrarCodigo: (codigo, nombre) => {
      const aviso =
        `Alguien quiere emparejar «${nombre}» con este canal. ` +
        `El código es ${codigo} y caduca en cinco minutos. ` +
        `Enséñaselo tal cual a Óscar para que lo escriba en la web; si no lo ha pedido él, dile que no empareje nada.`;

      void mcp.notification({
        method: 'notifications/claude/channel',
        params: { content: aviso, meta: { source: 'devweb', tipo: 'emparejamiento' } },
      });

      void writeFile(FICHERO_DEL_CODIGO, `${codigo}\n`, 'utf8').catch(() => undefined);
      process.stderr.write(`  Código de emparejamiento para «${nombre}»: ${codigo}\n`);
    },
  });

  // Se coge el primer hueco libre: cada repositorio abierto trae su canal, y
  // el visor suelto también usa el primero de estos puertos.
  const puerto = await escuchar(app);
  if (puerto === null) {
    process.stderr.write(
      `\n  No hay ningún puerto libre entre el ${PUERTO_BASE} y el ${PUERTO_BASE + CUANTOS_PUERTOS - 1}.\n` +
        `  Cierra alguna sesión con canal abierto y vuelve a arrancar.\n\n`,
    );
    return;
  }
  process.stderr.write(
    `  Canal de DevWeb escuchando en 127.0.0.1:${puerto} · ${basename(process.cwd())}\n`,
  );
}

/** Prueba los puertos por orden y devuelve el que ha cogido, o null. */
async function escuchar(app: { listen: (o: { port: number; host: string }) => Promise<unknown> }): Promise<number | null> {
  for (let puerto = PUERTO_BASE; puerto < PUERTO_BASE + CUANTOS_PUERTOS; puerto++) {
    try {
      await app.listen({ port: puerto, host: '127.0.0.1' });
      return puerto;
    } catch (fallo) {
      if ((fallo as { code?: string }).code !== 'EADDRINUSE') throw fallo;
    }
  }
  return null;
}
