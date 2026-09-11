import { describe, expect, it } from 'vitest';
import { leerTandas, resumirLineas } from './transcripcion';

/**
 * El fichero de una sesión guarda quince tipos de línea, y solo tres cuentan
 * para releerla. Estas pruebas fijan cuáles y qué se hace con el resto: lo que
 * no se entienda se ignora en silencio, porque el formato es de Claude Code y
 * puede crecer sin avisarnos.
 */

const linea = (o: unknown): string => JSON.stringify(o);

const TANDA_MIA = linea({
  type: 'user',
  uuid: 'u1',
  timestamp: '2026-09-10T10:00:00.000Z',
  gitBranch: 'main',
  message: { role: 'user', content: 'arregla el icono' },
});

const TANDA_SUYA = linea({
  type: 'assistant',
  uuid: 'a1',
  timestamp: '2026-09-10T10:00:05.000Z',
  gitBranch: 'main',
  message: {
    role: 'assistant',
    content: [
      { type: 'thinking', thinking: 'el icono sale de DESKTOP_ITEMS' },
      { type: 'text', text: 'Voy a mirarlo.' },
      { type: 'tool_use', name: 'Read', input: { file_path: 'desktop-items.ts' } },
    ],
  },
});

const RESULTADO = linea({
  type: 'user',
  uuid: 'u2',
  timestamp: '2026-09-10T10:00:06.000Z',
  message: {
    role: 'user',
    content: [{ type: 'tool_result', content: 'export const DESKTOP_ITEMS = [...]' }],
  },
});

describe('leer la transcripción de una sesión', () => {
  it('saca las tandas de quien habla, y solo esas', () => {
    const tandas = leerTandas([
      linea({ type: 'mode', mode: 'default' }),
      linea({ type: 'ai-title', aiTitle: 'Arreglar el escritorio' }),
      TANDA_MIA,
      TANDA_SUYA,
    ]);

    expect(tandas).toHaveLength(2);
    expect(tandas[0].autor).toBe('yo');
    expect(tandas[1].autor).toBe('claude');
  });

  it('el texto suelto también es una parte', () => {
    const [mia] = leerTandas([TANDA_MIA]);

    expect(mia.partes).toEqual([{ clase: 'texto', texto: 'arregla el icono' }]);
  });

  it('distingue lo que piensa, lo que dice y lo que hace', () => {
    const [suya] = leerTandas([TANDA_SUYA]);

    expect(suya.partes.map((p) => p.clase)).toEqual(['pensamiento', 'texto', 'herramienta']);
    const herramienta = suya.partes[2];
    if (herramienta.clase !== 'herramienta') throw new Error('no es una herramienta');
    expect(herramienta.nombre).toBe('Read');
    expect(herramienta.entrada).toContain('desktop-items.ts');
  });

  it('lo que devuelve una herramienta no es un mensaje mío', () => {
    const [tanda] = leerTandas([RESULTADO]);

    expect(tanda.partes[0].clase).toBe('resultado');
  });

  /** El formato es de Claude Code: si mañana trae algo nuevo, no se rompe. */
  it('una línea rota o desconocida no tumba la lectura', () => {
    const tandas = leerTandas([
      '{esto no es json',
      linea({ type: 'algo-que-no-existia', cosa: 1 }),
      TANDA_MIA,
    ]);

    expect(tandas).toHaveLength(1);
  });

  /**
   * Hay entradas de herramienta de megas —un fichero entero, un volcado—. En
   * la lista no se necesitan enteras, y traerlas cuesta memoria en el agente y
   * en el navegador.
   */
  it('recorta lo que es demasiado largo para leerlo en pantalla', () => {
    const largo = 'x'.repeat(50_000);
    const [tanda] = leerTandas([
      linea({
        type: 'assistant',
        uuid: 'a2',
        timestamp: '2026-09-10T10:00:00.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: largo }] },
      }),
    ]);

    const parte = tanda.partes[0];
    if (parte.clase !== 'texto') throw new Error('no es texto');
    expect(parte.texto.length).toBeLessThan(largo.length);
    expect(parte.texto).toContain('recortado');
  });

  it('marca lo que hizo un subagente, en vez de esconderlo', () => {
    const [tanda] = leerTandas([
      linea({
        type: 'assistant',
        uuid: 'a3',
        isSidechain: true,
        timestamp: '2026-09-10T10:00:00.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'buscando' }] },
      }),
    ]);

    expect(tanda.deSubagente).toBe(true);
  });
});

describe('resumir una sesión sin leerla entera', () => {
  it('saca el título que le puso Claude, la rama y las fechas', () => {
    const resumen = resumirLineas('s1', 'C--git', 1234, [
      linea({ type: 'ai-title', aiTitle: 'Arreglar el escritorio' }),
      TANDA_MIA,
      TANDA_SUYA,
    ]);

    expect(resumen.titulo).toBe('Arreglar el escritorio');
    expect(resumen.rama).toBe('main');
    expect(resumen.tandas).toBe(2);
    expect(resumen.empezo).toBe(Date.parse('2026-09-10T10:00:00.000Z'));
    expect(resumen.termino).toBe(Date.parse('2026-09-10T10:00:05.000Z'));
  });

  /** Sin título, la primera cosa que se pidió describe la sesión igual de bien. */
  it('y si no hay título, se queda con lo primero que se pidió', () => {
    const resumen = resumirLineas('s1', 'C--git', 10, [TANDA_MIA]);

    expect(resumen.titulo).toBe('arregla el icono');
  });

  it('una sesión vacía no revienta', () => {
    const resumen = resumirLineas('s1', 'C--git', 0, []);

    expect(resumen.tandas).toBe(0);
    expect(resumen.titulo).toBe('(sin título)');
  });
});
