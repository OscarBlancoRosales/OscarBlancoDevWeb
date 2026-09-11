import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { join } from 'node:path';
import { homedir } from 'node:os';
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

const PUERTO = Number(process.env['PUERTO'] ?? 4319);
const FICHERO_DE_ACCESO = join(homedir(), '.claude', 'devweb-canal', 'access.json');

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
    mostrarCodigo: (codigo, nombre) => {
      // Por la salida de error: la estándar es de MCP y meter ahí un texto
      // suelto rompería la conversación con Claude Code.
      process.stderr.write(
        `\n  ┌────────────────────────────────────────────┐\n` +
          `  │  Emparejar «${nombre}»\n` +
          `  │  Código: ${codigo}\n` +
          `  │  Caduca en cinco minutos.\n` +
          `  └────────────────────────────────────────────┘\n\n`,
      );
    },
  });

  try {
    await app.listen({ port: PUERTO, host: '127.0.0.1' });
  } catch (fallo) {
    // El visor a secas usa este mismo puerto. Si se quedó abierto, el canal no
    // puede tomarlo, y morir aquí en silencio se ve desde Claude Code como un
    // servidor que no arranca y ya está: sin esto, se pierde media tarde.
    const ocupado = (fallo as { code?: string }).code === 'EADDRINUSE';
    process.stderr.write(
      ocupado
        ? `\n  El puerto ${PUERTO} ya está ocupado, seguramente por el visor.\n` +
            `  Ciérralo (Ctrl+C donde corra «npm run start -w @devweb/agente») y vuelve\n` +
            `  a arrancar Claude Code. El canal ya trae el visor dentro: no hacen falta\n` +
            `  los dos.\n\n`
        : `\n  El canal no ha podido escuchar en ${PUERTO}: ${String(fallo)}\n\n`,
    );
    return;
  }
  process.stderr.write(`  Canal de DevWeb escuchando en 127.0.0.1:${PUERTO}\n`);
}
