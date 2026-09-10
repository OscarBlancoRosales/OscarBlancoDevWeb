import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import { invitacionDePrueba } from '../auth/testing';
import type { FastifyInstance } from 'fastify';
import type { ImpostorView } from '@devweb/shared/games/impostor/tipos';
import type { SeatGrant, ServerMessage } from '@devweb/shared/contracts/rooms';
import type { Db } from '../db/index';

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
});

const ALTA = { email: 'oscar@example.com', password: 'contraseña-larga-1', displayName: 'Óscar' };

/** Un cliente mínimo que espera por lo que busca en vez de dormir un rato. */
class Cliente {
  private readonly recibidos: ServerMessage[] = [];

  private constructor(private readonly socket: WebSocket) {
    socket.on('message', (raw: Buffer) => {
      this.recibidos.push(JSON.parse(raw.toString('utf8')) as ServerMessage);
    });
  }

  static conectar(url: string, pase: string): Promise<Cliente> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const cliente = new Cliente(socket);
      socket.once('open', () => {
        socket.send(JSON.stringify({ tipo: 'hola', pase }));
        resolve(cliente);
      });
      socket.once('error', reject);
    });
  }

  enviar(accion: unknown): void {
    this.socket.send(JSON.stringify({ tipo: 'accion', accion }));
  }

  get vistas(): ImpostorView[] {
    return this.recibidos
      .filter((mensaje) => mensaje.tipo === 'estado')
      .map((mensaje) => mensaje.vista as ImpostorView);
  }

  get ultima(): ImpostorView | undefined {
    return this.vistas.at(-1);
  }

  /** Espera a que la partida **esté** así, mirando solo la última vista. */
  async hasta(condicion: (vista: ImpostorView) => boolean, motivo: string): Promise<ImpostorView> {
    const plazo = Date.now() + 3000;
    for (;;) {
      const ahora = this.ultima;
      if (ahora && condicion(ahora)) return ahora;
      if (Date.now() > plazo) throw new Error(`No llegó: ${motivo}`);
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
  }

  cerrar(): void {
    this.socket.close();
  }
}

describe('una ronda del impostor contra dos bots', () => {
  let app: FastifyInstance;
  let db: Db;
  let url: string;
  let puerto = 0;
  let sala: SeatGrant;

  async function abrir(config: Record<string, unknown>): Promise<void> {
    await app.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: { ...ALTA, invitacion: invitacionDePrueba(db) },
    });
    db.prepare("UPDATE users SET status = 'active'").run();
    const acceso = await app.inject({
      method: 'POST',
      url: '/auth/acceso',
      payload: { email: ALTA.email, password: ALTA.password },
    });
    const token = acceso.json<{ accessToken: string }>().accessToken;

    sala = (
      await app.inject({
        method: 'POST',
        url: '/salas',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          game: 'impostor',
          name: 'Quién miente',
          displayName: 'Óscar',
          bots: ['Doge', 'Cheems'],
          config,
        },
      })
    ).json<SeatGrant>();
  }

  beforeEach(async () => {
    db = openDatabase(':memory:');
    app = await buildApp({ config, db });
    await app.listen({ port: 0, host: '127.0.0.1' });

    const direccion = app.server.address();
    puerto = typeof direccion === 'string' ? 0 : (direccion?.port ?? 0);
    await abrir({ tema: 'comida', modo: 'clasico', segundosDebate: 0 });
    url = `ws://127.0.0.1:${puerto}/ws?sala=${sala.room.id}`;
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('los bots se sientan solos y la sala reparte al decir tú que sí', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'listo' });

    const vista = await cliente.hasta((v) => v.fase !== 'sala', 'el reparto');
    expect(vista.orden).toHaveLength(3);
    expect(vista.tema).toBe('Comida y bebida');
    cliente.cerrar();
  });

  /**
   * La prueba que dice si esto es un juego o una pantalla bonita: la ronda
   * entera, con los bots hablando y votando, hasta que hay ganador.
   */
  it('se juega la ronda entera y acaba con un desenlace', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'listo' });

    let vista = await cliente.hasta((v) => v.fase === 'pistas', 'el turno de pistas');
    const dichas = new Set<string>();

    for (let paso = 0; paso < 40 && vista.fase !== 'fin'; paso++) {
      if (vista.dice) dichas.add(vista.dice);

      // Se espera a que la partida cambie de verdad, no a que la última vista
      // siga diciendo lo mismo: mandar una jugada y volver a mirar el mismo
      // estado gira en el sitio y no avanza nunca.
      const antes = huella(vista);

      if (vista.fase === 'pistas' && vista.tuTurno) {
        cliente.enviar({ tipo: 'pista', texto: `algo-${paso}` });
      } else if (vista.fase === 'debate') {
        cliente.enviar({ tipo: 'alVoto' });
      } else if (vista.fase === 'votacion' && vista.tuVoto === null) {
        const otro = vista.orden.find((seat) => seat !== sala.seatId);
        cliente.enviar({ tipo: 'votar', aQuien: otro });
      } else if (vista.fase === 'ultima-palabra' && vista.tuDisparo) {
        cliente.enviar({ tipo: 'adivinar', opcion: 0 });
      }

      vista = await cliente.hasta(
        (v) => v.fase === 'fin' || huella(v) !== antes,
        'que la ronda avance',
      );
    }

    expect(vista.fase, 'la ronda tiene que acabar').toBe('fin');
    expect(vista.desenlace).not.toBeNull();
    expect(vista.palabra, 'al acabar se destapa la palabra').not.toBeNull();
    expect(vista.impostores, 'y quién mentía').not.toBeNull();
    expect(dichas.size, 'y la sala ha ido hablando').toBeGreaterThan(0);
    cliente.cerrar();
  });

  /** El secreto entero del juego es que esto no viaje. */
  it('la palabra y los impostores no salen del servidor mientras se juega', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'listo' });
    await cliente.hasta((v) => v.fase === 'pistas', 'el turno de pistas');

    for (const vista of cliente.vistas) {
      if (vista.fase === 'fin') continue;
      expect(vista.palabra).toBeNull();
      expect(vista.impostores).toBeNull();
    }
    cliente.cerrar();
  });

  it('un no del juego llega por el mismo canal que las jugadas', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'listo' });
    await cliente.hasta((v) => v.fase === 'pistas', 'el turno de pistas');

    // Votar antes de tiempo: la ronda va por pistas y esto no toca todavía.
    cliente.enviar({ tipo: 'votar', aQuien: sala.seatId });

    const rechazo = await esperarRechazo(cliente);
    expect(rechazo).toBe('aun-no-se-vota');
    cliente.cerrar();
  });

  /**
   * Con reloj, la votación se abre sola: nadie tiene que acordarse.
   *
   * Un segundo en la prueba, minuto y medio en una mesa de verdad. Lo que se
   * comprueba es que el que cuenta es el servidor y no una pantalla.
   */
  it('el debate con reloj se cierra solo al agotarse', async () => {
    await abrir({ tema: 'comida', modo: 'clasico', segundosDebate: 1 });
    const cliente = await Cliente.conectar(
      `ws://127.0.0.1:${puerto}/ws?sala=${sala.room.id}`,
      sala.seatToken,
    );
    cliente.enviar({ tipo: 'listo' });

    let vista = await cliente.hasta((v) => v.fase === 'pistas', 'el turno de pistas');
    for (let paso = 0; paso < 20 && vista.fase === 'pistas'; paso++) {
      const antes = huella(vista);
      if (vista.tuTurno) cliente.enviar({ tipo: 'pista', texto: `algo-${paso}` });
      vista = await cliente.hasta((v) => huella(v) !== antes, 'que avancen las pistas');
    }

    expect(vista.fase).toBe('debate');
    const conReloj = await cliente.hasta((v) => v.debateHasta > 0, 'el reloj del debate');
    expect(conReloj.segundosDebate).toBe(1);

    const votando = await cliente.hasta((v) => v.fase === 'votacion', 'que se acabe el tiempo');
    expect(votando.fase).toBe('votacion');
    cliente.cerrar();
  });

  /**
   * Entre las pistas y la votación se habla, y el reloj lo lleva el servidor.
   *
   * Es la diferencia entre un juego de deducción y un sorteo: sin este rato,
   * la mesa vota cuatro palabras sueltas y a ver qué sale.
   */
  it('tras las pistas se abre un debate con el reloj del servidor', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'listo' });

    let vista = await cliente.hasta((v) => v.fase === 'pistas', 'el turno de pistas');
    for (let paso = 0; paso < 20 && vista.fase === 'pistas'; paso++) {
      const antes = huella(vista);
      if (vista.tuTurno) cliente.enviar({ tipo: 'pista', texto: `algo-${paso}` });
      vista = await cliente.hasta((v) => huella(v) !== antes, 'que avancen las pistas');
    }

    expect(vista.fase, 'se habla antes de votar').toBe('debate');
    expect(vista.dice.length, 'y la sala lo anuncia').toBeGreaterThan(0);
    // Esta sala se abrió sin reloj: lo corta el anfitrión.
    expect(vista.segundosDebate).toBe(0);
    expect(vista.debateHasta).toBe(0);

    cliente.enviar({ tipo: 'alVoto' });
    vista = await cliente.hasta((v) => v.fase === 'votacion', 'la votación');
    expect(vista.fase).toBe('votacion');
    cliente.cerrar();
  });

  it('nadie puede repartirse la palabra a sí mismo', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({
      tipo: 'reparte',
      palabra: 'Pizza',
      senuelo: 'Empanada',
      orden: [sala.seatId],
      impostores: ['otro'],
      opciones: ['Pizza'],
      semilla: 1,
    });

    const rechazo = await esperarRechazo(cliente);
    expect(rechazo).toBe('accion-del-servidor');
    cliente.cerrar();
  });
});

/** En qué punto está la ronda, para saber si ha cambiado algo de verdad. */
function huella(vista: ImpostorView): string {
  return [vista.fase, vista.pistas.length, vista.hanVotado.length, vista.intento].join('/');
}

/** El primer «no» que manda el servidor, con su código. */
async function esperarRechazo(cliente: Cliente): Promise<string> {
  const plazo = Date.now() + 3000;
  for (;;) {
    const rechazo = rechazosDe(cliente).at(-1);
    if (rechazo) return rechazo;
    if (Date.now() > plazo) throw new Error('No llegó ningún rechazo');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

function rechazosDe(cliente: Cliente): string[] {
  const recibidos = (cliente as unknown as { recibidos: ServerMessage[] }).recibidos;
  return recibidos.filter((m) => m.tipo === 'rechazada').map((m) => m.code);
}
