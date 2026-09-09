import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import { PREGUNTAS_POR_PARTIDA } from '../games/trivial/banco';
import type { FastifyInstance } from 'fastify';
import type { TrivialView } from '@devweb/shared/games/trivial/tipos';
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

  /**
   * Se conecta y se identifica.
   *
   * El pase va en un mensaje y no en la URL: una URL acaba escrita en el log de
   * nginx y en el de la aplicación, en claro y en disco.
   */
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

  get vistas(): TrivialView[] {
    return this.recibidos
      .filter((mensaje) => mensaje.tipo === 'estado')
      .map((mensaje) => mensaje.vista as TrivialView);
  }

  async vistaCuando(condicion: (vista: TrivialView) => boolean, motivo: string): Promise<TrivialView> {
    const plazo = Date.now() + 3000;
    for (;;) {
      const encontrada = this.vistas.findLast(condicion);
      if (encontrada) return encontrada;
      if (Date.now() > plazo) throw new Error(`No llegó: ${motivo}`);
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
  }

  cerrar(): void {
    this.socket.close();
  }
}

describe('un concurso de trivial contra el bot', () => {
  let app: FastifyInstance;
  let db: Db;
  let url: string;
  let sala: SeatGrant;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    app = await buildApp({ config, db });
    await app.listen({ port: 0, host: '127.0.0.1' });

    const direccion = app.server.address();
    const puerto = typeof direccion === 'string' ? 0 : (direccion?.port ?? 0);

    await app.inject({ method: 'POST', url: '/auth/registro', payload: ALTA });
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
          game: 'trivial',
          name: 'Concurso',
          displayName: 'Óscar',
          bots: ['Sabelotodo'],
          config: { nivelBot: 'sabelotodo' },
        },
      })
    ).json<SeatGrant>();

    url = `ws://127.0.0.1:${puerto}/ws?sala=${sala.room.id}`;
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('el bot se sienta solo y el concurso arranca al decir tu que si', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'empezar' });

    const vista = await cliente.vistaCuando((v) => v.fase === 'ronda', 'la primera pregunta');
    expect(vista.enunciado.length).toBeGreaterThan(0);
    expect(vista.rondas).toBe(PREGUNTAS_POR_PARTIDA);
    cliente.cerrar();
  });

  it('el bot contesta su ronda sin que nadie se lo pida', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'empezar' });
    await cliente.vistaCuando((v) => v.fase === 'ronda', 'la primera pregunta');

    const vista = await cliente.vistaCuando(
      (v) => v.hanRespondido.length > 0,
      'la respuesta del bot',
    );
    expect(vista.hanRespondido).toHaveLength(1);
    cliente.cerrar();
  });

  it('la ronda se cierra al contestar tu, y entonces sale la solucion', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'empezar' });
    const abierta = await cliente.vistaCuando((v) => v.fase === 'ronda', 'la primera pregunta');

    expect(abierta.correcta).toBeNull();
    cliente.enviar({ tipo: 'responder', valor: abierta.tipo === 'estimacion' ? 1990 : 0 });

    const cerrada = await cliente.vistaCuando((v) => v.cerrada, 'el cierre de la ronda');
    expect(cerrada.correcta).not.toBeNull();
    expect(cerrada.explicacion).not.toBeNull();
    expect(cerrada.resultados).toHaveLength(2);
    cliente.cerrar();
  });

  it('la respuesta correcta no viaja mientras se puede contestar', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'empezar' });
    await cliente.vistaCuando((v) => v.fase === 'ronda', 'la primera pregunta');

    for (const vista of cliente.vistas) {
      if (!vista.cerrada) {
        expect(vista.correcta).toBeNull();
        expect(vista.explicacion).toBeNull();
        expect(vista.resultados).toBeNull();
      }
    }
    cliente.cerrar();
  });
});
