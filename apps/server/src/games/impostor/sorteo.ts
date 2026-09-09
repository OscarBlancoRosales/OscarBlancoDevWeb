import { randomInt } from 'node:crypto';
import { MINIMO_JUGADORES, OPCIONES_ULTIMA_PALABRA } from '@devweb/shared/games/impostor/tipos';
import { TEMA_MEZCLA, terminosDe } from '@devweb/shared/games/impostor/temas';
import { impostoresQueCaben } from '@devweb/shared/games/impostor/reglas';
import type { Reparto } from '@devweb/shared/games/impostor/tipos';
import type { SeatId } from '@devweb/shared/games/module';

/**
 * El sorteo de la ronda: la palabra, los impostores y el orden de la mesa.
 *
 * Vive en el servidor y no en el módulo del juego por una razón que es todo el
 * juego: el módulo es puro, así que cualquier cosa que decidiera se podría
 * volver a calcular desde el navegador con los mismos datos de entrada. Quién
 * es el impostor no puede salir de un cálculo que cualquiera pueda repetir.
 *
 * Lo que sale de aquí entra en la partida como una acción del servidor y se
 * queda en el registro de eventos, que nunca se manda a nadie: al navegador
 * solo llega lo que `view` deja pasar.
 */

/** De dónde sale el azar. Entra por parámetro para poder probar el sorteo. */
export type Azar = (min: number, maxExclusivo: number) => number;

export interface EncargoDeSorteo {
  readonly jugadores: readonly SeatId[];
  readonly temaId: string;
  readonly impostoresPedidos: number;
  readonly azar?: Azar;
}

/** El reparto de una ronda, o `null` si en esa mesa no se puede jugar. */
export function sortear(encargo: EncargoDeSorteo): Reparto | null {
  const azar = encargo.azar ?? randomInt;
  if (encargo.jugadores.length < MINIMO_JUGADORES) return null;

  const terminos = terminosDe(encargo.temaId);
  const banco = terminos.length > 0 ? terminos : terminosDe(TEMA_MEZCLA);
  const termino = banco.at(azar(0, banco.length));
  if (!termino) return null;

  const orden = barajar(encargo.jugadores, azar);
  const cuantos = impostoresQueCaben(orden.length, encargo.impostoresPedidos);

  return {
    tipo: 'reparte',
    palabra: termino.a,
    senuelo: termino.b,
    orden,
    impostores: barajar(orden, azar).slice(0, cuantos),
    opciones: opcionesDeDisparo(termino.a, termino.b, banco, azar),
    semilla: azar(0, 2 ** 31),
  };
}

/**
 * Las palabras que se le ofrecen al impostor pillado.
 *
 * La buena, su parecida y cuatro más del mismo tema, todas revueltas. La
 * parecida entra siempre a propósito: es la que de verdad duele, porque un
 * impostor que ha seguido la conversación llega hasta ahí y ahí se atasca.
 */
function opcionesDeDisparo(
  palabra: string,
  senuelo: string,
  banco: readonly { readonly a: string }[],
  azar: Azar,
): string[] {
  const puestas = new Set<string>([palabra, senuelo]);
  for (const otro of barajar(banco, azar)) {
    if (puestas.size >= OPCIONES_ULTIMA_PALABRA) break;
    puestas.add(otro.a);
  }
  return barajar([...puestas], azar);
}

/** Fisher-Yates con el azar que le den. No toca la entrada. */
export function barajar<T>(items: readonly T[], azar: Azar): T[] {
  const salida = items.slice();
  for (let i = salida.length - 1; i > 0; i--) {
    const j = azar(0, i + 1);
    const uno = salida[i];
    const otro = salida[j];
    if (uno === undefined || otro === undefined) continue;
    salida[i] = otro;
    salida[j] = uno;
  }
  return salida;
}
