import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { ClientMessage } from '@devweb/shared/contracts/rooms';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { ServerMessage } from '@devweb/shared/contracts/rooms';
import type { RoomService } from './service';
import type { Suscriptor } from './actor';

const Query = Type.Object({
  sala: Type.String({ minLength: 1, maxLength: 64 }),
  pase: Type.String({ minLength: 8, maxLength: 200 }),
});

/** Un mensaje mayor que esto no es una jugada, es un intento de tumbar el proceso. */
const MAXIMO_MENSAJE = 64 * 1024;

export function roomSocket(service: RoomService): FastifyPluginCallbackTypebox {
  return (app, _options, done) => {
    app.get('/ws', { websocket: true, schema: { querystring: Query } }, (socket, request) => {
      const { sala, pase } = request.query;

      // El pase se comprueba ANTES de tocar la sala: un WebSocket abierto sin
      // asiento válido no debe llegar ni a reconstruir el estado.
      const seatId = service.asientoDe(sala, pase);
      if (!seatId) {
        socket.close(4401, 'pase-invalido');
        return;
      }

      let actor;
      try {
        actor = service.actor(sala);
      } catch {
        socket.close(4404, 'sala-inexistente');
        return;
      }

      const suscriptor: Suscriptor = {
        seatId,
        send(message: ServerMessage) {
          if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
        },
      };

      actor.subscribe(suscriptor);

      socket.on('message', (raw: Buffer) => {
        if (raw.length > MAXIMO_MENSAJE) {
          suscriptor.send({ tipo: 'rechazada', code: 'mensaje-enorme', message: 'Mensaje demasiado grande.' });
          return;
        }

        const mensaje = parse(raw);
        if (!mensaje) {
          suscriptor.send({ tipo: 'rechazada', code: 'mensaje-invalido', message: 'No entiendo ese mensaje.' });
          return;
        }
        if (mensaje.tipo === 'ping') {
          suscriptor.send({ tipo: 'pong' });
          return;
        }

        const rechazo = actor.submit(seatId, mensaje.accion);
        if (rechazo) {
          suscriptor.send({ tipo: 'rechazada', code: rechazo.code, message: rechazo.message });
        }
      });

      /**
       * Soltar la conexión no puede fallar.
       *
       * Cuando esto corre, el cliente ya no está: no hay nada que contarle y no
       * hay nada que reintentar. Y una excepción dentro de un manejador de
       * `close` no la recoge nadie, así que se lleva el proceso por delante y
       * con él todas las demás salas.
       */
      const soltar = (): void => {
        try {
          actor.unsubscribe(suscriptor);
          service.programarDescarga(sala);
        } catch (error) {
          request.log.warn({ err: error, sala }, 'fallo al soltar una conexión de sala');
        }
      };

      socket.on('close', soltar);
      socket.on('error', soltar);
    });

    done();
  };
}

function parse(raw: Buffer): { tipo: 'accion'; accion: unknown } | { tipo: 'ping' } | null {
  try {
    const parsed: unknown = JSON.parse(raw.toString('utf8'));
    return Value.Check(ClientMessage, parsed) ? parsed : null;
  } catch {
    return null;
  }
}
