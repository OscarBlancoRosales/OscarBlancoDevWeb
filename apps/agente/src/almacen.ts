import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { leerTandas, resumirLineas } from './transcripcion';
import type { ResumenDeSesion, Sesion } from '@devweb/shared/contracts/sesiones';

/**
 * De dónde salen las sesiones: del disco, tal y como las deja Claude Code.
 *
 * Un directorio por proyecto y un JSONL por sesión. Los ficheros son grandes
 * —los hay de cuarenta megas— así que se leen por líneas y nunca de golpe, y
 * los resúmenes se guardan mientras el fichero no cambie: listar ocho sesiones
 * no puede costar releer trescientos megas cada vez que se abre la pantalla.
 */

export const RAIZ_POR_DEFECTO = join(homedir(), '.claude', 'projects');

/** Solo importan las líneas de quien habla, y el título que puso Claude. */
const INTERESA = /"type":\s*"(user|assistant|ai-title)"/;

interface Fichero {
  readonly proyecto: string;
  readonly id: string;
  readonly ruta: string;
  readonly bytes: number;
  readonly tocado: number;
}

async function lineasDe(ruta: string, soloInteresantes = true): Promise<string[]> {
  const salida: string[] = [];
  const rl = createInterface({
    input: createReadStream(ruta, 'utf8'),
    crlfDelay: Infinity,
  });
  for await (const linea of rl) {
    if (linea === '') continue;
    if (soloInteresantes && !INTERESA.test(linea)) continue;
    salida.push(linea);
  }
  return salida;
}

export class Almacen {
  /** Resúmenes ya calculados, por ruta. Se tiran si el fichero cambia. */
  private readonly cache = new Map<string, { tocado: number; bytes: number; resumen: ResumenDeSesion }>();

  constructor(private readonly raiz: string = RAIZ_POR_DEFECTO) {}

  /** Los JSONL que hay ahora mismo, con su proyecto. */
  private async ficheros(): Promise<Fichero[]> {
    let proyectos: string[];
    try {
      proyectos = await readdir(this.raiz);
    } catch {
      return [];
    }

    const salida: Fichero[] = [];
    for (const proyecto of proyectos) {
      const carpeta = join(this.raiz, proyecto);
      let dentro: string[];
      try {
        dentro = await readdir(carpeta);
      } catch {
        continue;
      }
      for (const nombre of dentro.filter((n) => n.endsWith('.jsonl'))) {
        const ruta = join(carpeta, nombre);
        try {
          const info = await stat(ruta);
          salida.push({
            proyecto,
            id: nombre.replace(/\.jsonl$/, ''),
            ruta,
            bytes: info.size,
            tocado: info.mtimeMs,
          });
        } catch {
          // Un fichero que desaparece mientras se lista no es un problema.
        }
      }
    }
    return salida;
  }

  /** Todas las sesiones, de la más reciente a la más vieja. */
  async listar(): Promise<ResumenDeSesion[]> {
    const ficheros = await this.ficheros();
    const resumenes = await Promise.all(ficheros.map((f) => this.resumir(f)));
    return resumenes.sort((a, b) => b.termino - a.termino);
  }

  private async resumir(fichero: Fichero): Promise<ResumenDeSesion> {
    const guardado = this.cache.get(fichero.ruta);
    if (guardado?.tocado === fichero.tocado && guardado.bytes === fichero.bytes) {
      return guardado.resumen;
    }
    const lineas = await lineasDe(fichero.ruta);
    const resumen = resumirLineas(fichero.id, fichero.proyecto, fichero.bytes, lineas);
    this.cache.set(fichero.ruta, { tocado: fichero.tocado, bytes: fichero.bytes, resumen });
    return resumen;
  }

  /**
   * Una sesión entera, por tandas.
   *
   * Se pagina porque las hay de mil doscientas tandas: mandarlas juntas es un
   * mordisco de memoria en el agente y un navegador atascado en la otra punta.
   */
  async abrir(id: string, desde = 0, cuantas = 60): Promise<Sesion | null> {
    const fichero = (await this.ficheros()).find((f) => f.id === id);
    if (!fichero) return null;

    const lineas = await lineasDe(fichero.ruta);
    const todas = leerTandas(lineas);
    const resumen = await this.resumir(fichero);

    return {
      resumen,
      tandas: todas.slice(desde, desde + cuantas),
      total: todas.length,
    };
  }
}
