import type { Parte, ResumenDeSesion, Tanda } from '@devweb/shared/contracts/sesiones';

/**
 * Lee lo que Claude Code deja escrito de cada sesión.
 *
 * El fichero es un JSONL con quince tipos de línea: mensajes, adjuntos, modos,
 * estado del coste, latidos del puente... Para releer una sesión solo importan
 * las de `user` y `assistant`, y el título que Claude le puso.
 *
 * El formato es de Claude Code y puede crecer sin avisarnos, así que la regla
 * es: lo que no se entienda, se ignora. Un tipo de línea nuevo no puede dejar
 * la pantalla en blanco.
 */

/** Más de esto no se lee de una vez en pantalla, y ocupa en las dos puntas. */
const LARGO_MAXIMO = 4000;

function recortar(texto: string): string {
  if (texto.length <= LARGO_MAXIMO) return texto;
  const sobran = texto.length - LARGO_MAXIMO;
  return `${texto.slice(0, LARGO_MAXIMO)}\n\n… recortado, ${sobran.toLocaleString('es-ES')} caracteres más`;
}

interface LineaCruda {
  type?: unknown;
  uuid?: unknown;
  timestamp?: unknown;
  gitBranch?: unknown;
  isSidechain?: unknown;
  aiTitle?: unknown;
  message?: { role?: unknown; content?: unknown };
}

function comoObjeto(linea: string): LineaCruda | null {
  try {
    const leido: unknown = JSON.parse(linea);
    return leido !== null && typeof leido === 'object' ? leido : null;
  } catch {
    return null;
  }
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor : '');

function momento(valor: unknown): number {
  const marca = typeof valor === 'string' ? Date.parse(valor) : NaN;
  return Number.isNaN(marca) ? 0 : marca;
}

/**
 * Una parte del contenido, traducida.
 *
 * Devuelve null para lo que no sabemos pintar: imágenes, documentos y lo que
 * venga mañana. Se prefiere perder una parte a perder la tanda entera.
 */
function comoParte(cruda: unknown): Parte | null {
  if (cruda === null || typeof cruda !== 'object') return null;
  const parte = cruda as { type?: unknown; text?: unknown; thinking?: unknown; name?: unknown; input?: unknown; content?: unknown; is_error?: unknown };

  switch (parte.type) {
    case 'text':
      return { clase: 'texto', texto: recortar(texto(parte.text)) };
    case 'thinking':
      return { clase: 'pensamiento', texto: recortar(texto(parte.thinking)) };
    case 'tool_use':
      return {
        clase: 'herramienta',
        nombre: texto(parte.name),
        entrada: recortar(typeof parte.input === 'string' ? parte.input : JSON.stringify(parte.input ?? {})),
      };
    case 'tool_result':
      return {
        clase: 'resultado',
        texto: recortar(
          typeof parte.content === 'string' ? parte.content : JSON.stringify(parte.content ?? ''),
        ),
        error: parte.is_error === true,
      };
    default:
      return null;
  }
}

function partesDe(contenido: unknown): Parte[] {
  if (typeof contenido === 'string') return [{ clase: 'texto', texto: recortar(contenido) }];
  if (!Array.isArray(contenido)) return [];
  return contenido.map(comoParte).filter((parte): parte is Parte => parte !== null);
}

/** Las tandas de una sesión, en el orden en que ocurrieron. */
export function leerTandas(lineas: readonly string[]): Tanda[] {
  const tandas: Tanda[] = [];
  for (const linea of lineas) {
    const o = comoObjeto(linea);
    if (!o || (o.type !== 'user' && o.type !== 'assistant')) continue;

    const partes = partesDe(o.message?.content);
    if (partes.length === 0) continue;

    tandas.push({
      id: texto(o.uuid),
      autor: o.type === 'user' ? 'yo' : 'claude',
      cuando: momento(o.timestamp),
      partes,
      deSubagente: o.isSidechain === true,
    });
  }
  return tandas;
}

/**
 * Lo justo para listar una sesión sin leerla entera.
 *
 * El título lo pone Claude en una línea `ai-title`; si no llegó a ponerlo, la
 * primera cosa que se pidió describe la sesión igual de bien.
 */
export function resumirLineas(
  id: string,
  proyecto: string,
  bytes: number,
  lineas: readonly string[],
): ResumenDeSesion {
  let titulo = '';
  let primeraPeticion = '';
  let rama = '';
  let empezo = 0;
  let termino = 0;
  let tandas = 0;

  for (const linea of lineas) {
    const o = comoObjeto(linea);
    if (!o) continue;

    if (o.type === 'ai-title' && titulo === '') titulo = texto(o.aiTitle);
    if (o.type !== 'user' && o.type !== 'assistant') continue;

    const partes = partesDe(o.message?.content);
    if (partes.length === 0) continue;
    tandas += 1;

    if (rama === '') rama = texto(o.gitBranch);
    const cuando = momento(o.timestamp);
    if (cuando > 0) {
      if (empezo === 0) empezo = cuando;
      termino = cuando;
    }
    if (primeraPeticion === '' && o.type === 'user') {
      const primera = partes.find((p) => p.clase === 'texto');
      if (primera?.clase === 'texto') primeraPeticion = primera.texto;
    }
  }

  return {
    id,
    proyecto,
    titulo: titulo || primeraPeticion.slice(0, 90) || '(sin título)',
    rama,
    empezo,
    termino,
    tandas,
    bytes,
  };
}
