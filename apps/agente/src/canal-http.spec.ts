import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Acceso } from './acceso';
import { Almacen } from './almacen';
import { Buzon } from './buzon';
import { construirAgente } from './servidor';
import type { FastifyInstance } from 'fastify';

/**
 * Las rutas por las que se escribe.
 *
 * Todas exigen un dispositivo emparejado: el token sale de un código que solo
 * aparece en el terminal, así que una cookie de administrador robada no abre
 * nada de aquí. Quien quiera entrar tiene que haberse presentado una vez
 * delante del ordenador.
 */
describe('el canal, por HTTP', () => {
  let app: FastifyInstance;
  let carpeta = '';
  let acceso: Acceso;
  let empujados: string[];
  let veredictos: [string, string][];
  let buzon: Buzon;
  let codigoVisto = '';

  beforeEach(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'canal-'));
    acceso = new Acceso(join(carpeta, 'access.json'));
    await acceso.cargar();
    empujados = [];
    veredictos = [];
    buzon = new Buzon(
      (texto) => empujados.push(texto),
      (id, veredicto) => veredictos.push([id, veredicto]),
    );
    app = await construirAgente({
      almacen: new Almacen(join(carpeta, 'sin-sesiones')),
      acceso,
      buzon,
      mostrarCodigo: (codigo) => {
        codigoVisto = codigo;
      },
    });
  });

  afterEach(async () => {
    await app.close();
    await rm(carpeta, { recursive: true, force: true });
  });

  /** El emparejamiento entero, que es como se entra la primera vez. */
  async function emparejar(): Promise<string> {
    await app.inject({ method: 'POST', url: '/emparejar/empezar', payload: { nombre: 'el móvil' } });
    const respuesta = await app.inject({
      method: 'POST',
      url: '/emparejar',
      payload: { codigo: codigoVisto },
    });
    return respuesta.json<{ token: string }>().token;
  }

  const como = (token: string) => ({ authorization: `Bearer ${token}` });

  it('avisa de que hay canal, para que la web enseñe el cuadro de escribir', async () => {
    const salud = await app.inject({ method: 'GET', url: '/salud' });

    expect(salud.json<{ canal: boolean }>().canal).toBe(true);
  });

  /**
   * El código sale por el terminal y NO por la respuesta: es lo único que
   * obliga a estar delante del ordenador una vez.
   */
  it('el código de emparejamiento no viaja por la red', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/emparejar/empezar',
      payload: { nombre: 'el móvil' },
    });

    expect(respuesta.body).not.toContain(codigoVisto);
    expect(codigoVisto).toMatch(/^\d{6}$/);
  });

  it('sin emparejar no se escribe, ni se lee la conversación', async () => {
    const escribir = await app.inject({ method: 'POST', url: '/mensaje', payload: { texto: 'eh' } });
    const leer = await app.inject({ method: 'GET', url: '/conversacion' });

    expect(escribir.statusCode).toBe(401);
    expect(leer.statusCode).toBe(401);
    expect(empujados).toEqual([]);
  });

  it('con un token inventado, tampoco', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/mensaje',
      headers: como('me-lo-invento'),
      payload: { texto: 'eh' },
    });

    expect(respuesta.statusCode).toBe(401);
    expect(empujados).toEqual([]);
  });

  it('emparejado, lo que escribes llega a la sesión', async () => {
    const token = await emparejar();

    const respuesta = await app.inject({
      method: 'POST',
      url: '/mensaje',
      headers: como(token),
      payload: { texto: 'arregla el icono' },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(empujados).toEqual(['arregla el icono']);
  });

  it('y la conversación se puede releer', async () => {
    const token = await emparejar();
    await app.inject({
      method: 'POST',
      url: '/mensaje',
      headers: como(token),
      payload: { texto: 'hola' },
    });
    buzon.responder('qué tal');

    const respuesta = await app.inject({ method: 'GET', url: '/conversacion', headers: como(token) });

    expect(respuesta.json<{ mensajes: { texto: string }[] }>().mensajes.map((m) => m.texto)).toEqual([
      'hola',
      'qué tal',
    ]);
  });

  describe('los permisos', () => {
    it('se ven los que Claude está esperando', async () => {
      const token = await emparejar();
      buzon.pedirPermiso({ id: 'abcde', herramienta: 'Bash', descripcion: 'Probar', detalle: 'npm test' });

      const respuesta = await app.inject({ method: 'GET', url: '/conversacion', headers: como(token) });

      expect(respuesta.json<{ permisos: { id: string }[] }>().permisos[0].id).toBe('abcde');
    });

    it('y se contestan desde aquí', async () => {
      const token = await emparejar();
      buzon.pedirPermiso({ id: 'abcde', herramienta: 'Bash', descripcion: 'Probar', detalle: 'npm test' });

      const respuesta = await app.inject({
        method: 'POST',
        url: '/permisos/abcde',
        headers: como(token),
        payload: { veredicto: 'allow' },
      });

      expect(respuesta.statusCode).toBe(200);
      expect(veredictos).toEqual([['abcde', 'allow']]);
    });

    /** Aprobar es lo más serio que se puede hacer por aquí. */
    it('pero no sin estar emparejado', async () => {
      buzon.pedirPermiso({ id: 'abcde', herramienta: 'Bash', descripcion: 'Probar', detalle: 'rm -rf' });

      const respuesta = await app.inject({
        method: 'POST',
        url: '/permisos/abcde',
        payload: { veredicto: 'allow' },
      });

      expect(respuesta.statusCode).toBe(401);
      expect(veredictos).toEqual([]);
    });

    it('y lo que ya se contestó en el ordenador no se contesta otra vez', async () => {
      const token = await emparejar();

      const respuesta = await app.inject({
        method: 'POST',
        url: '/permisos/nunca-existio',
        headers: como(token),
        payload: { veredicto: 'allow' },
      });

      expect(respuesta.statusCode).toBe(409);
      expect(veredictos).toEqual([]);
    });
  });

  /**
   * El ataque clásico contra un servicio de `localhost`: una web apunta su
   * propio dominio a 127.0.0.1 y sus peticiones pasan a ser del mismo origen,
   * así que ningún CORS las mira. Lo que no puede falsificar es el `Host`.
   */
  describe('contra el que se hace pasar por tu máquina', () => {
    it('no se contesta a quien llama con otro nombre', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/sesiones',
        headers: { host: 'malo.example' },
      });

      expect(respuesta.statusCode).toBe(403);
    });

    it('ni para emparejarse, que es la puerta de entrada', async () => {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/emparejar/empezar',
        headers: { host: 'malo.example' },
        payload: { nombre: 'colado' },
      });

      expect(respuesta.statusCode).toBe(403);
    });

    it('y sí a quien llama a esta máquina por su nombre', async () => {
      for (const host of ['127.0.0.1:4319', 'localhost:4319']) {
        const respuesta = await app.inject({ method: 'GET', url: '/salud', headers: { host } });
        expect(respuesta.statusCode, host).toBe(200);
      }
    });
  });

  /** Sin canal montado, el agente sigue siendo lo que era: un visor. */
  it('sin canal, esas rutas ni existen', async () => {
    const soloLee = await construirAgente({ almacen: new Almacen(join(carpeta, 'sin-sesiones')) });

    const salud = await soloLee.inject({ method: 'GET', url: '/salud' });
    const escribir = await soloLee.inject({ method: 'POST', url: '/mensaje', payload: { texto: 'x' } });

    expect(salud.json<{ canal: boolean }>().canal).toBe(false);
    expect(escribir.statusCode).toBe(404);
    await soloLee.close();
  });
});
