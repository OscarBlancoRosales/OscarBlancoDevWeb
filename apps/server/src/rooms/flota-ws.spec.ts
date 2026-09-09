import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import type { FastifyInstance } from 'fastify';
import type { FlotaView } from '@devweb/shared/games/flota/tipos';
import type { SeatGrant, ServerMessage } from '@devweb/shared/contracts/rooms';
import type { Db } from '../db/index';

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
});

const ALTA = { email: 'oscar@example.com', password: 'contraseña-larga-1', displayName: 'Óscar' };

/** Una flota legal en las cinco primeras filas. */
const FLOTA = [
  { fila: 0, columna: 0, tamano: 5, orientacion: 'horizontal' },
  { fila: 1, columna: 0, tamano: 4, orientacion: 'horizontal' },
  { fila: 2, columna: 0, tamano: 3, orientacion: 'horizontal' },
  { fila: 3, columna: 0, tamano: 3, orientacion: 'horizontal' },
  { fila: 4, columna: 0, tamano: 2, orientacion: 'horizontal' },
];

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

  async vistaCuando(condicion: (vista: FlotaView) => boolean, motivo: string): Promise<FlotaView> {
    const plazo = Date.now() + 3000;
    for (;;) {
      const vistas = this.recibidos
        .filter((mensaje) => mensaje.tipo === 'estado')
        .map((mensaje) => mensaje.vista as FlotaView);
      const encontrada = vistas.findLast(condicion);
      if (encontrada) return encontrada;
      if (Date.now() > plazo) throw new Error(`No llegó: ${motivo}`);
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
  }

  get vistas(): FlotaView[] {
    return this.recibidos
      .filter((mensaje) => mensaje.tipo === 'estado')
      .map((mensaje) => mensaje.vista as FlotaView);
  }

  cerrar(): void {
    this.socket.close();
  }
}

describe('una partida de flota contra el bot', () => {
  let app: FastifyInstance;
  let db: Db;
  let sala: SeatGrant;
  let url: string;

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
          game: 'flota',
          name: 'Contra la maquina',
          displayName: 'Óscar',
          bots: ['Almirante'],
          config: { semilla: 42, nivelBot: 'almirante' },
        },
      })
    ).json<SeatGrant>();

    url = `ws://127.0.0.1:${puerto}/ws?sala=${sala.room.id}`;
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('el bot despliega su flota solo en cuanto tu despliegas la tuya', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);

    cliente.enviar({ tipo: 'desplegar', barcos: FLOTA });
    const vista = await cliente.vistaCuando((v) => v.fase === 'combate', 'el arranque del combate');

    expect(vista.turno).toBe(sala.seatId);
    expect(vista.desplegados).toHaveLength(2);
    cliente.cerrar();
  });

  it('el bot contesta al disparo que falla, y no antes', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'desplegar', barcos: FLOTA });
    await cliente.vistaCuando((v) => v.fase === 'combate', 'el arranque del combate');

    // La flota del bot está donde la haya puesto la semilla, así que en vez de
    // buscar un fallo seguro se dispara hasta que uno cae al agua.
    for (let columna = 0; columna < 10; columna++) {
      cliente.enviar({ tipo: 'disparar', fila: 9, columna });
    }

    const vista = await cliente.vistaCuando(
      (v) => (v.tuyo?.recibidos.filter((casilla) => casilla !== null).length ?? 0) > 0,
      'la respuesta del bot',
    );
    expect(vista.fase).not.toBe('colocacion');
    cliente.cerrar();
  });

  it('la flota del bot no viaja mientras la partida sigue viva', async () => {
    const cliente = await Cliente.conectar(url, sala.seatToken);
    cliente.enviar({ tipo: 'desplegar', barcos: FLOTA });
    await cliente.vistaCuando((v) => v.fase === 'combate', 'el arranque del combate');

    for (const vista of cliente.vistas) {
      if (vista.fase !== 'fin') expect(vista.flotaRival).toBeNull();
    }
    cliente.cerrar();
  });
});
