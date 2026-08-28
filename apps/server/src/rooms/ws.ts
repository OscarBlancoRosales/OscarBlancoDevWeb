import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { ClientMessage } from '@devweb/shared/contracts/rooms';
import type { ClientMessage as MensajeDelCliente } from '@devweb/shared/contracts/rooms';
import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { ServerMessage } from '@devweb/shared/contracts/rooms';
import type { RoomActor, Suscriptor } from './actor';
import type { RoomService } from './service';

/**
 * En la URL va la sala, nunca el pase.
 *
 * El pase es la credencial del asiento, y una URL no es sitio para una
 * credencial: la línea de petición entera acaba escrita en el log de nginx y en
 * el de la aplicación, en claro y en disco. Por eso se manda en el primer
 * mensaje, que viaja dentro de la conexión y no lo registra nadie.
 */
const Query = Type.Object({
  sala: Type.String({ minLength: 1, maxLength: 64 }),
});

/** Un mensaje mayor que esto no es una jugada, es un intento de tumbar el proceso. */
const MAXIMO_MENSAJE = 64 * 1024;

/** Lo que se espera a que alguien diga quién es antes de echarlo. */
const ESPERA_PARA_IDENTIFICARSE_MS = 10_000;

interface Sesion {
  readonly seatId: string;
  readonly actor: RoomActor;
  readonly suscriptor: Suscriptor;
}

export function roomSocket(service: RoomService): FastifyPluginCallbackTypebox {
  return (app, _options, done) => {
    app.get('/ws', { websocket: true, schema: { querystring: Query } }, (socket, request) => {
      const { sala } = request.query;

      const responder = (message: ServerMessage): void => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
      };

      let sesion: Sesion | null = null;

      // Una conexión que nunca se identifica ocupa un socket y algo de memoria
      // sin llegar a ser nada. A los diez segundos, fuera.
      const plazo = setTimeout(() => {
        if (!sesion) socket.close(4401, 'sin-identificar');
      }, ESPERA_PARA_IDENTIFICARSE_MS);

      /** Abre la sesión con el pase. Devuelve `null` y cierra si no vale. */
      const identificar = (pase: string): Sesion | null => {
        const seatId = service.asientoDe(sala, pase);
        if (!seatId) {
          socket.close(4401, 'pase-invalido');
          return null;
        }

        let actor;
        try {
          actor = service.actor(sala);
        } catch {
          socket.close(4404, 'sala-inexistente');
          return null;
        }

        const suscriptor: Suscriptor = { seatId, send: responder };
        actor.subscribe(suscriptor);
        return { seatId, actor, suscriptor };
      };

      socket.on('message', (raw: Buffer) => {
        if (raw.length > MAXIMO_MENSAJE) {
          responder({
            tipo: 'rechazada',
            code: 'mensaje-enorme',
            message: 'Mensaje demasiado grande.',
          });
          return;
        }

        const mensaje = parse(raw);
        if (!mensaje) {
          responder({
            tipo: 'rechazada',
            code: 'mensaje-invalido',
            message: 'No entiendo ese mensaje.',
          });
          return;
        }

        // Antes de decir quién eres no se juega, no se habla y no se mira: el
        // estado de la sala solo sale hacia un asiento comprobado.
        if (!sesion) {
          if (mensaje.tipo !== 'hola') {
            socket.close(4401, 'sin-identificar');
            return;
          }
          sesion = identificar(mensaje.pase);
          if (sesion) clearTimeout(plazo);
          return;
        }

        const { seatId, actor, suscriptor } = sesion;

        if (mensaje.tipo === 'hola') return;

        if (mensaje.tipo === 'ping') {
          suscriptor.send({ tipo: 'pong' });
          return;
        }

        if (mensaje.tipo === 'chat') {
          // Se puede hablar por un bot de la sala —los bots comentan su jugada—
          // pero no por otra persona: eso sería ponerle palabras en la boca.
          const comoAsiento = mensaje.comoAsiento ?? seatId;
          if (comoAsiento !== seatId && !actor.esBot(comoAsiento)) {
            suscriptor.send({
              tipo: 'rechazada',
              code: 'no-eres-tu',
              message: 'No puedes hablar por otra persona.',
            });
            return;
          }
          const negado = actor.decir(
            comoAsiento,
            mensaje.texto,
            mensaje.comoLaSala ?? false,
            mensaje.origin,
          );
          if (negado) {
            suscriptor.send({ tipo: 'rechazada', code: negado.code, message: negado.message });
          }
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
        clearTimeout(plazo);
        if (!sesion) return;
        try {
          sesion.actor.unsubscribe(sesion.suscriptor);
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

function parse(raw: Buffer): MensajeDelCliente | null {
  try {
    const parsed: unknown = JSON.parse(raw.toString('utf8'));
    return Value.Check(ClientMessage, parsed) ? parsed : null;
  } catch {
    return null;
  }
}
