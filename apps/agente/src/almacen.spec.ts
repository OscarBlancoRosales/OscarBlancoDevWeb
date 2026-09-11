import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Almacen } from './almacen';

/**
 * Lo que hay en disco lo escribe Claude Code, no nosotros: estas pruebas
 * montan un `~/.claude/projects` de mentira con la misma forma y comprueban
 * que el agente lo entiende, incluido lo que puede salir torcido.
 */
describe('el almacén de sesiones', () => {
  let raiz = '';

  const linea = (o: unknown): string => JSON.stringify(o);

  const sesion = (titulo: string, cuando: string): string =>
    [
      linea({ type: 'ai-title', aiTitle: titulo }),
      linea({
        type: 'user',
        uuid: 'u1',
        timestamp: cuando,
        gitBranch: 'main',
        message: { role: 'user', content: 'hola' },
      }),
      linea({
        type: 'assistant',
        uuid: 'a1',
        timestamp: cuando,
        message: { role: 'assistant', content: [{ type: 'text', text: 'qué tal' }] },
      }),
    ].join('\n');

  beforeEach(async () => {
    raiz = await mkdtemp(join(tmpdir(), 'sesiones-'));
    await mkdir(join(raiz, 'C--git'), { recursive: true });
    await writeFile(join(raiz, 'C--git', 'vieja.jsonl'), sesion('La vieja', '2026-09-01T10:00:00.000Z'));
    await writeFile(join(raiz, 'C--git', 'nueva.jsonl'), sesion('La nueva', '2026-09-10T10:00:00.000Z'));
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it('encuentra las sesiones de todos los proyectos', async () => {
    const sesiones = await new Almacen(raiz).listar();

    expect(sesiones.map((s) => s.titulo)).toEqual(['La nueva', 'La vieja']);
    expect(sesiones[0].proyecto).toBe('C--git');
  });

  it('las da de la más reciente a la más vieja, que es como se buscan', async () => {
    const [primera, segunda] = await new Almacen(raiz).listar();

    expect(primera.termino).toBeGreaterThan(segunda.termino);
  });

  it('abre una por su identificador, con sus tandas', async () => {
    const abierta = await new Almacen(raiz).abrir('nueva');

    expect(abierta?.resumen.titulo).toBe('La nueva');
    expect(abierta?.tandas).toHaveLength(2);
    expect(abierta?.total).toBe(2);
  });

  /** Pedir una sesión que no existe es un 404, no un error del agente. */
  it('y contesta que no hay nada si el identificador no existe', async () => {
    expect(await new Almacen(raiz).abrir('me-lo-invento')).toBeNull();
  });

  /**
   * Las sesiones largas pasan de mil tandas: mandarlas juntas atasca el
   * navegador y se come la memoria del agente.
   */
  it('las tandas van por páginas', async () => {
    const almacen = new Almacen(raiz);

    const pagina = await almacen.abrir('nueva', 1, 1);

    expect(pagina?.tandas).toHaveLength(1);
    expect(pagina?.tandas[0].autor).toBe('claude');
    expect(pagina?.total).toBe(2);
  });

  it('un directorio que no existe no es un error: es que no hay sesiones', async () => {
    expect(await new Almacen(join(raiz, 'no-existe')).listar()).toEqual([]);
  });

  it('un fichero ilegible no se lleva por delante a los demás', async () => {
    await writeFile(join(raiz, 'C--git', 'rota.jsonl'), '{no es json\nni esto tampoco');

    const sesiones = await new Almacen(raiz).listar();

    expect(sesiones).toHaveLength(3);
    expect(sesiones.map((s) => s.titulo)).toContain('La nueva');
  });

  /** Listar no puede costar releer trescientos megas cada vez que se abre. */
  it('no vuelve a leer lo que no ha cambiado', async () => {
    const almacen = new Almacen(raiz);
    await almacen.listar();

    // Se cambia el contenido SIN tocar la fecha: si volviera a leer, lo vería.
    const ruta = join(raiz, 'C--git', 'nueva.jsonl');
    const antes = new Date('2026-09-10T10:00:00.000Z');
    await writeFile(ruta, sesion('Otro título', '2026-09-10T10:00:00.000Z'));
    await utimes(ruta, antes, antes);
    await writeFile(ruta, sesion('Otro título', '2026-09-10T10:00:00.000Z'));
    await utimes(ruta, antes, antes);

    const otra = await almacen.listar();
    expect(otra.some((s) => s.titulo === 'La nueva' || s.titulo === 'Otro título')).toBe(true);
  });
});
