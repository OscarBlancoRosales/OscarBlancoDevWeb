import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Acceso } from './acceso';

/**
 * Quién puede hablarle a tu sesión.
 *
 * El emparejamiento es lo único que separa «mi web» de «cualquiera con mi
 * cookie»: el código aparece en TU terminal, así que hay que estar delante del
 * ordenador una vez. A partir de ahí ese dispositivo entra siempre, que es lo
 * que se pidió, y se le puede echar cuando quieras.
 */
describe('el control de acceso al canal', () => {
  let carpeta = '';
  let acceso: Acceso;

  beforeEach(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'acceso-'));
    acceso = new Acceso(join(carpeta, 'access.json'));
    await acceso.cargar();
  });

  afterEach(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });

  it('al principio no hay nadie dentro', () => {
    expect(acceso.dispositivos()).toEqual([]);
    expect(acceso.reconoce('lo-que-sea')).toBe(false);
  });

  it('el código de emparejamiento se puede teclear sin equivocarse', () => {
    const codigo = acceso.empezarEmparejamiento('el móvil');

    // Seis dígitos: ni mayúsculas que se confundan, ni letras ambiguas.
    expect(codigo).toMatch(/^\d{6}$/);
  });

  it('con el código bueno, el dispositivo queda dentro para siempre', async () => {
    const codigo = acceso.empezarEmparejamiento('el móvil');

    const token = await acceso.emparejar(codigo);

    expect(token).toBeTruthy();
    expect(acceso.reconoce(token ?? '')).toBe(true);
    expect(acceso.dispositivos().map((d) => d.nombre)).toEqual(['el móvil']);
  });

  it('con uno inventado, fuera', async () => {
    acceso.empezarEmparejamiento('el móvil');

    expect(await acceso.emparejar('000000')).toBeNull();
    expect(acceso.dispositivos()).toEqual([]);
  });

  /** Un código que vale siempre es una contraseña de seis dígitos. */
  it('el código solo vale una vez', async () => {
    const codigo = acceso.empezarEmparejamiento('el móvil');
    await acceso.emparejar(codigo);

    expect(await acceso.emparejar(codigo)).toBeNull();
    expect(acceso.dispositivos()).toHaveLength(1);
  });

  /**
   * Seis cifras son un millón de combinaciones, y eso no es nada para un
   * script. El tope de intentos es lo que las convierte en tres oportunidades.
   */
  it('a los tres fallos el código muere, aunque después aciertes', async () => {
    const codigo = acceso.empezarEmparejamiento('el móvil');

    expect(await acceso.emparejar('000001')).toBeNull();
    expect(await acceso.emparejar('000002')).toBeNull();
    expect(await acceso.emparejar('000003')).toBeNull();

    expect(await acceso.emparejar(codigo)).toBeNull();
    expect(acceso.dispositivos()).toEqual([]);
  });

  it('pero fallar una vez no impide acertar a la siguiente', async () => {
    const codigo = acceso.empezarEmparejamiento('el móvil');

    expect(await acceso.emparejar('000001')).toBeNull();

    expect(await acceso.emparejar(codigo)).toBeTruthy();
  });

  it('y caduca solo, para que no se quede uno vivo en el terminal', async () => {
    let ahora = 1_000_000;
    const conReloj = new Acceso(join(carpeta, 'reloj.json'), () => ahora);
    await conReloj.cargar();
    const codigo = conReloj.empezarEmparejamiento('tarde');

    ahora += 6 * 60 * 1000;

    expect(await conReloj.emparejar(codigo)).toBeNull();
  });

  it('lo aprendido sobrevive a cerrar el agente', async () => {
    const codigo = acceso.empezarEmparejamiento('el móvil');
    const token = await acceso.emparejar(codigo);

    const otraVez = new Acceso(join(carpeta, 'access.json'));
    await otraVez.cargar();

    expect(otraVez.reconoce(token ?? '')).toBe(true);
  });

  it('y se puede echar a un dispositivo', async () => {
    const codigo = acceso.empezarEmparejamiento('el viejo');
    const token = await acceso.emparejar(codigo);
    const [dispositivo] = acceso.dispositivos();

    await acceso.olvidar(dispositivo.id);

    expect(acceso.reconoce(token ?? '')).toBe(false);
    expect(acceso.dispositivos()).toEqual([]);
  });

  /**
   * El fichero es el único sitio donde vive esto, así que se guarda con la
   * forma que se espera al releerlo: si mañana cambia, se nota aquí.
   */
  it('el token no se guarda en claro', async () => {
    const codigo = acceso.empezarEmparejamiento('el móvil');
    const token = await acceso.emparejar(codigo);

    const guardado = await readFile(join(carpeta, 'access.json'), 'utf8');

    expect(guardado).not.toContain(token);
    expect(guardado).toContain('el móvil');
  });

  it('un fichero corrupto se trata como que no hay nadie, no como un error', async () => {
    const roto = new Acceso(join(carpeta, 'no-existe', 'access.json'));

    await expect(roto.cargar()).resolves.not.toThrow();
    expect(roto.dispositivos()).toEqual([]);
  });
});
