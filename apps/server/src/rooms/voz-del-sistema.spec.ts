import { describe, expect, it } from 'vitest';
import { Type } from '@sinclair/typebox';
import { RoomActor } from './actor';
import type { GameModule } from '@devweb/shared/games/module';
import type { EventRow, RoomRepository, RoomRow, SeatRow } from './repository';

/**
 * Las acciones que solo puede poner el servidor.
 *
 * La voz del presentador entra en la partida como una acción más -así llega a
 * toda la mesa por el mismo canal y sobrevive a recargar la página-, y eso la
 * haría falsificable: sin esta puerta, cualquiera podría poner al presentador a
 * decirle lo que quisiera al resto de jugadores.
 */

const ASIENTOS: SeatRow[] = [
  {
    roomId: 'sala',
    seatId: 'ana',
    userId: null,
    displayName: 'Ana',
    isBot: false,
    tokenHash: 'x',
    order: 0,
    meta: {},
  },
];

/** Un juego tonto que solo guarda lo último que se dijo. */
function juego(): GameModule<unknown, { tipo: string; frase?: string }> {
  return {
    id: 'trivial',
    actionSchema: Type.Object({
      tipo: Type.String(),
      frase: Type.Optional(Type.String()),
    }),
    accionesDeSistema: ['presenta'],
    createState: () => ({ dicho: '' }),
    validate: () => null,
    apply: (state, action) => (action.frase ? { dicho: action.frase } : state),
    view: (state) => state,
  };
}

/** Un repositorio en memoria: estas pruebas no van de guardar nada. */
function repositorio(): RoomRepository {
  const eventos: EventRow[] = [];
  const sala: RoomRow = {
    id: 'sala',
    game: 'trivial',
    name: 'Concurso',
    status: 'playing',
    ownerId: null,
    config: {},
    createdAt: 0,
    updatedAt: 0,
  };
  return {
    eventos,
    findRoom: () => sala,
    listSeats: () => ASIENTOS,
    listEventsAfter: (_id: string, seq: number) => eventos.filter((uno) => uno.seq > seq),
    listChat: () => [],
    appendEvent: (_id: string, evento: EventRow) => {
      eventos.push(evento);
    },
    touchRoom: () => undefined,
    saveSnapshot: () => undefined,
    findSnapshot: () => null,
  } as unknown as RoomRepository & { eventos: EventRow[] };
}

function actor(): RoomActor {
  return new RoomActor({
    roomId: 'sala',
    module: juego(),
    repository: repositorio(),
    status: 'playing',
  });
}

function vista(sala: RoomActor): { dicho: string } {
  const mensaje = sala.messageFor('ana') as { vista: { dicho: string } | null };
  return mensaje.vista ?? { dicho: '' };
}

describe('la voz del sistema', () => {
  it('un cliente no puede hablar por el presentador', () => {
    const sala = actor();
    const rechazo = sala.submit('ana', { tipo: 'presenta', frase: 'Ana ha hecho trampas.' });

    expect(rechazo?.code).toBe('accion-del-servidor');
    expect(vista(sala).dicho).toBe('');
  });

  it('pero el servidor sí', () => {
    const sala = actor();
    sala.aplicarDelSistema('ana', { tipo: 'presenta', frase: 'Buenas noches.' });
    expect(vista(sala).dicho).toBe('Buenas noches.');
  });

  it('y las acciones normales siguen pasando', () => {
    const sala = actor();
    expect(sala.submit('ana', { tipo: 'responder', frase: 'vale' })).toBeNull();
    expect(vista(sala).dicho).toBe('vale');
  });

  /** Si no quedara en el registro, recargar la página borraría al presentador. */
  it('lo que dice el servidor queda registrado como todo lo demás', () => {
    const sala = actor();
    const antes = sala.ultimaSecuencia;
    sala.aplicarDelSistema('ana', { tipo: 'presenta', frase: 'Hola.' });
    expect(sala.ultimaSecuencia).toBe(antes + 1);
  });

  it('una acción de sistema deforme no rompe la sala', () => {
    const sala = actor();
    sala.aplicarDelSistema('ana', { no: 'es una acción' });
    expect(vista(sala).dicho).toBe('');
  });
});
