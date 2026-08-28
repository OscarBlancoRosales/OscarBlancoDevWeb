import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/index';
import type { FastifyInstance } from 'fastify';
import type { ScrumView } from '@devweb/shared/games/scrum';
import type { ChatEntry, SeatGrant, ServerMessage } from '@devweb/shared/contracts/rooms';
import type { Db } from '../db/index';

const config = loadConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://oscarblancorosales.com',
});

const ALTA = { email: 'oscar@example.com', password: 'contraseña-larga-1', displayName: 'Óscar' };

/**
 * Un cliente de sala que recuerda lo recibido.
 *
 * Los mensajes llegan cuando llegan, así que en vez de dormir un rato y cruzar
 * los dedos, `esperar` resuelve en cuanto aparece el mensaje que se busca.
 */
class Cliente {
  private readonly recibidos: ServerMessage[] = [];
  private readonly esperas: (() => void)[] = [];

  private constructor(private readonly socket: WebSocket) {
    socket.on('message', (raw: Buffer) => {
      this.recibidos.push(JSON.parse(raw.toString('utf8')) as ServerMessage);
      for (const avisar of this.esperas.splice(0)) avisar();
    });
  }

  /** Se conecta y se identifica, que es lo que hace el navegador. */
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

  /** Se conecta, se identifica mal, y devuelve con qué código lo echan. */
  static rechazo(url: string, saludo: unknown): Promise<number> {
    return new Promise((resolve) => {
      const socket = new WebSocket(url);
      socket.once('open', () => { socket.send(JSON.stringify(saludo)); });
      socket.on('close', (code: number) => { resolve(code); });
      socket.on('error', () => undefined);
    });
  }

  enviar(mensaje: unknown): void {
    this.socket.send(JSON.stringify(mensaje));
  }

  async esperar(predicado: (m: ServerMessage) => boolean, motivo: string): Promise<ServerMessage> {
    const plazo = Date.now() + 3000;
    for (;;) {
      const encontrado = this.recibidos.findLast(predicado);
      if (encontrado) return encontrado;
      if (Date.now() > plazo) throw new Error(`No llegó: ${motivo}`);
      await new Promise<void>((resolve) => {
        this.esperas.push(resolve);
        setTimeout(resolve, 50);
      });
    }
  }

  async estado(seq: number): Promise<{ vista: ScrumView; seats: { id: string }[] }> {
    const mensaje = await this.esperar(
      (m) => m.tipo === 'estado' && m.seq >= seq,
      `estado con seq >= ${seq}`,
    );
    return mensaje as unknown as { vista: ScrumView; seats: { id: string }[] };
  }

  esperarRechazo(): Promise<ServerMessage> {
    return this.esperar((m) => m.tipo === 'rechazada', 'un rechazo');
  }

  async chat(cuantas: number): Promise<ChatEntry[]> {
    const mensaje = await this.esperar(
      (m) => m.tipo === 'chat' && m.entradas.length >= cuantas,
      `${cuantas} entradas de chat`,
    );
    return (mensaje as { entradas: ChatEntry[] }).entradas;
  }

  cerrar(): void {
    this.socket.close();
  }
}

describe('una partida de scrum poker por WebSocket', () => {
  let app: FastifyInstance;
  let db: Db;
  let base: string;
  let anfitrion: SeatGrant;
  let invitada: SeatGrant;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    app = await buildApp({ config, db });
    await app.listen({ port: 0, host: '127.0.0.1' });

    const direccion = app.server.address();
    const puerto = typeof direccion === 'string' ? 0 : (direccion?.port ?? 0);
    base = `ws://127.0.0.1:${puerto}/ws`;

    await app.inject({ method: 'POST', url: '/auth/registro', payload: ALTA });
    db.prepare("UPDATE users SET status = 'active'").run();
    const acceso = await app.inject({
      method: 'POST',
      url: '/auth/acceso',
      payload: { email: ALTA.email, password: ALTA.password },
    });
    const token = acceso.json<{ accessToken: string }>().accessToken;

    anfitrion = (
      await app.inject({
        method: 'POST',
        url: '/salas',
        headers: { authorization: `Bearer ${token}` },
        payload: { game: 'scrum', name: 'Sprint 42', displayName: 'Óscar' },
      })
    ).json<SeatGrant>();

    invitada = (
      await app.inject({
        method: 'POST',
        url: `/salas/${anfitrion.room.id}/unirse`,
        payload: { displayName: 'Ana' },
      })
    ).json<SeatGrant>();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  const urlDe = (grant: SeatGrant): string => `${base}?sala=${grant.room.id}`;

  const conectar = (grant: SeatGrant): Promise<Cliente> =>
    Cliente.conectar(urlDe(grant), grant.seatToken);

  it('el pase no viaja en la URL, que es lo que acaba en los logs', () => {
    expect(urlDe(anfitrion)).not.toContain(anfitrion.seatToken);
  });

  it('sin pase válido no se entra en la sala', async () => {
    const codigo = await Cliente.rechazo(urlDe(anfitrion), {
      tipo: 'hola',
      pase: 'me-lo-invento',
    });

    expect(codigo).toBe(4401);
  });

  it('el pase de una sala no vale para otra', async () => {
    const codigo = await Cliente.rechazo(`${base}?sala=otra-sala-cualquiera`, {
      tipo: 'hola',
      pase: anfitrion.seatToken,
    });

    expect([4401, 4404]).toContain(codigo);
  });

  it('quien juega sin haberse identificado se va a la calle', async () => {
    const codigo = await Cliente.rechazo(urlDe(anfitrion), {
      tipo: 'accion',
      accion: { tipo: 'revelar' },
    });

    expect(codigo).toBe(4401);
  });

  it('al conectar llega el estado inicial', async () => {
    const cliente = await conectar(anfitrion);

    const { vista } = await cliente.estado(0);

    expect(vista).toMatchObject({ revelado: false, ronda: 1, hanVotado: [], votos: {} });
    cliente.cerrar();
  });

  it('el voto de otro NO sale del servidor mientras no se revele', async () => {
    const oscar = await conectar(anfitrion);
    const ana = await conectar(invitada);

    ana.enviar({ tipo: 'accion', accion: { tipo: 'votar', voto: { tipo: 'numero', valor: 13 } } });
    const { vista } = await oscar.estado(1);

    // Óscar sabe que Ana ha votado, pero no qué.
    expect(vista.hanVotado).toEqual([invitada.seatId]);
    expect(vista.votos).toEqual({});

    oscar.cerrar();
    ana.cerrar();
  });

  it('cada uno sí ve su propio voto', async () => {
    const ana = await conectar(invitada);

    ana.enviar({ tipo: 'accion', accion: { tipo: 'votar', voto: { tipo: 'numero', valor: 13 } } });
    const { vista } = await ana.estado(1);

    expect(vista.votos).toEqual({ [invitada.seatId]: { tipo: 'numero', valor: 13 } });
    ana.cerrar();
  });

  it('al revelar, todos ven todo y aparece el resumen', async () => {
    const oscar = await conectar(anfitrion);
    const ana = await conectar(invitada);

    oscar.enviar({ tipo: 'accion', accion: { tipo: 'votar', voto: { tipo: 'numero', valor: 5 } } });
    ana.enviar({ tipo: 'accion', accion: { tipo: 'votar', voto: { tipo: 'numero', valor: 13 } } });
    await oscar.estado(2);
    oscar.enviar({ tipo: 'accion', accion: { tipo: 'revelar' } });

    const { vista } = await oscar.estado(3);

    expect(vista.revelado).toBe(true);
    expect(Object.keys(vista.votos)).toHaveLength(2);
    expect(vista.resumen).toMatchObject({ media: 9, mediana: 9, acuerdo: false });

    oscar.cerrar();
    ana.cerrar();
  });

  it('una jugada ilegal se rechaza y no cambia nada', async () => {
    const ana = await conectar(invitada);

    ana.enviar({ tipo: 'accion', accion: { tipo: 'revelar' } });
    const rechazo = await ana.esperarRechazo();

    expect(rechazo).toMatchObject({ tipo: 'rechazada', code: 'sin-votos' });
    ana.cerrar();
  });

  it('un número cualquiera vale: aquí se vota sumando y a mano', async () => {
    const ana = await conectar(invitada);

    ana.enviar({ tipo: 'accion', accion: { tipo: 'votar', voto: { tipo: 'numero', valor: 36 } } });
    const { vista } = await ana.estado(1);

    expect(vista.votos).toEqual({ [invitada.seatId]: { tipo: 'numero', valor: 36 } });
    ana.cerrar();
  });

  it('pero un número absurdo se rechaza antes de llegar a las reglas', async () => {
    const ana = await conectar(invitada);

    ana.enviar({
      tipo: 'accion',
      accion: { tipo: 'votar', voto: { tipo: 'numero', valor: 1_000_000_000 } },
    });
    const rechazo = await ana.esperarRechazo();

    expect(rechazo).toMatchObject({ code: 'accion-desconocida' });
    ana.cerrar();
  });

  it('un mensaje que no es del protocolo se rechaza sin tirar la conexión', async () => {
    const ana = await conectar(invitada);

    ana.enviar({ tipo: 'haz-lo-que-quieras' });
    await ana.esperarRechazo();

    // Y la sala sigue funcionando.
    ana.enviar({ tipo: 'accion', accion: { tipo: 'votar', voto: { tipo: 'cafe' } } });
    const { vista } = await ana.estado(1);
    expect(vista.hanVotado).toEqual([invitada.seatId]);

    ana.cerrar();
  });

  it('la partida sobrevive a reconectarse', async () => {
    const ana = await conectar(invitada);
    ana.enviar({ tipo: 'accion', accion: { tipo: 'votar', voto: { tipo: 'numero', valor: 8 } } });
    await ana.estado(1);
    ana.cerrar();

    const devuelta = await conectar(invitada);
    const { vista } = await devuelta.estado(1);

    expect(vista.votos).toEqual({ [invitada.seatId]: { tipo: 'numero', valor: 8 } });
    devuelta.cerrar();
  });

  it('el log guarda cada jugada, que es lo que permite reconstruir', async () => {
    const ana = await conectar(invitada);
    ana.enviar({ tipo: 'accion', accion: { tipo: 'votar', voto: { tipo: 'cafe' } } });
    await ana.estado(1);

    const eventos = db.prepare('SELECT seq, seat_id, action_json FROM room_events').all() as {
      seq: number;
      seat_id: string;
      action_json: string;
    }[];

    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ seq: 1, seat_id: invitada.seatId });
    expect(JSON.parse(eventos[0]?.action_json ?? '{}')).toEqual({
      tipo: 'votar',
      voto: { tipo: 'cafe' },
    });

    ana.cerrar();
  });

  describe('hablar en la sala', () => {
    it('lo dicho llega a todos con el nombre que pone el servidor', async () => {
      const oscar = await conectar(anfitrion);
      const ana = await conectar(invitada);

      ana.enviar({ tipo: 'chat', texto: 'yo lo veo un 13' });
      const entradas = await oscar.chat(1);

      expect(entradas[0]).toMatchObject({
        seq: 1,
        authorId: invitada.seatId,
        author: 'Ana',
        kind: 'player',
        text: 'yo lo veo un 13',
      });

      oscar.cerrar();
      ana.cerrar();
    });

    it('firmar con el asiento de otra persona no cuela', async () => {
      const ana = await conectar(invitada);

      ana.enviar({ tipo: 'chat', texto: 'lo dijo Óscar', comoAsiento: anfitrion.seatId });
      const rechazo = await ana.esperarRechazo();

      expect(rechazo).toMatchObject({ tipo: 'rechazada', code: 'no-eres-tu' });
      ana.cerrar();
    });

    it('un jugador no publica avisos con la voz de la sala', async () => {
      const ana = await conectar(invitada);

      ana.enviar({ tipo: 'chat', texto: 'La sala expulsa a Óscar', comoLaSala: true });
      const rechazo = await ana.esperarRechazo();

      expect(rechazo).toMatchObject({ tipo: 'rechazada', code: 'no-eres-la-sala' });
      ana.cerrar();
    });

    it('el anfitrión sí, y el mensaje sale firmado por la sala', async () => {
      const oscar = await conectar(anfitrion);

      oscar.enviar({ tipo: 'chat', texto: '¡Que empiece!', comoLaSala: true });
      const entradas = await oscar.chat(1);

      expect(entradas[0]).toMatchObject({ kind: 'system', author: 'Sala', authorId: 'system' });
      oscar.cerrar();
    });

    it('quien llega tarde recibe lo que ya se había hablado', async () => {
      const ana = await conectar(invitada);
      ana.enviar({ tipo: 'chat', texto: 'empezamos' });
      await ana.chat(1);

      const oscar = await conectar(anfitrion);
      const entradas = await oscar.chat(1);

      expect(entradas.map((entrada) => entrada.text)).toEqual(['empezamos']);

      oscar.cerrar();
      ana.cerrar();
    });
  });
});
