import { terminoDeLaPalabra, terminosDe } from './temas';
import { palabraPara } from './reglas';
import type { Rng } from '../../engine/rng';
import type { SeatId } from '../module';
import type { ImpostorState } from './tipos';

/**
 * Lo que hace un asiento que no tiene a nadie detrás.
 *
 * Los bots de este juego son malos a propósito, y conviene decir por qué. Un
 * bot tiene delante el estado entero: sabe la palabra y sabe quién es el
 * impostor. Usar eso para votar sería un bot que gana siempre y una partida que
 * no se juega. Así que aquí solo se mira lo que también ve una persona —el tema
 * y las pistas dichas— y lo demás lo decide el azar de la partida.
 *
 * Da un resultado parecido al de mucha gente en una mesa de verdad, que es más
 * de lo que parece.
 */

/**
 * La pista que suelta un bot en su turno.
 *
 * Si tiene palabra —tripulación, o infiltrado, que se cree que la tiene— dice
 * una de las suyas, sin repetir lo que ya se ha dicho. Si no la tiene, se
 * inventa una de otra palabra del mismo tema: es exactamente lo que hace una
 * persona cuando le toca hablar sin saber de qué va la mesa.
 */
export function pistaDelBot(state: ImpostorState, seat: SeatId, rng: Rng): string {
  const dichas = new Set(state.pistas.map((pista) => pista.texto.toLowerCase()));
  const mia = palabraPara(
    state.modo,
    state.impostores.includes(seat),
    state.palabra,
    state.senuelo,
  );

  const candidatas = mia === null ? pistasAjenas(state) : pistasDe(state, mia);
  const libres = candidatas.filter((texto) => !dichas.has(texto.toLowerCase()));
  const donde = libres.length > 0 ? libres : candidatas;

  return donde[rng.int(0, donde.length - 1)] ?? 'cosas';
}

/** Las pistas de la palabra que le tocó. */
function pistasDe(state: ImpostorState, palabra: string): readonly string[] {
  return terminoDeLaPalabra(state.temaId, palabra)?.pistas ?? [];
}

/**
 * Pistas de cualquier otra palabra del tema.
 *
 * El impostor no puede acertar por casualidad con las de la buena: si lo
 * hiciera, sería un impostor que sabe la palabra, y eso no es el juego.
 */
function pistasAjenas(state: ImpostorState): readonly string[] {
  return terminosDe(state.temaId)
    .filter((termino) => termino.a !== state.palabra)
    .flatMap((termino) => termino.pistas);
}

/**
 * A quién vota un bot.
 *
 * A ciegas entre los demás, salvo una cosa: un impostor no vota a otro
 * impostor. Eso no es leer la mesa, es no pegarse un tiro en el pie, y lo hace
 * cualquiera que sepa con quién va.
 */
export function votoDelBot(state: ImpostorState, seat: SeatId, rng: Rng): SeatId | null {
  const otros = state.orden.filter((otro) => otro !== seat);
  if (otros.length === 0) return null;

  const soyImpostor = state.impostores.includes(seat);
  const preferidos = soyImpostor
    ? otros.filter((otro) => !state.impostores.includes(otro))
    : otros;
  const donde = preferidos.length > 0 ? preferidos : otros;

  return donde[rng.int(0, donde.length - 1)] ?? null;
}

/**
 * La palabra que dispara un bot pillado.
 *
 * Al azar entre las que le ofrecen, y esto sí que no puede ser de otra manera:
 * el bot tiene la palabra buena delante, en el estado. Elegirla sería ganar
 * haciendo trampa, y encima siempre.
 */
export function disparoDelBot(state: ImpostorState, rng: Rng): number {
  if (state.opciones.length === 0) return 0;
  return rng.int(0, state.opciones.length - 1);
}
