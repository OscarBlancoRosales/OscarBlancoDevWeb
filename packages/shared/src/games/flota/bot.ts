import { LADO, TAMANOS_FLOTA } from './tipos';
import { cabe, indice } from './reglas';
import type { Barco, Casilla, Nivel } from './tipos';
import type { Rng } from '../../engine/rng';

/**
 * Cuántas veces se prueba a meter un barco antes de rendirse.
 *
 * Con cinco barcos en cien casillas no se agota nunca; el tope está para que
 * cambiar la flota algún día no se convierta en un proceso girando.
 */
const INTENTOS_POR_BARCO = 200;

/** Una flota legal colocada al azar, determinista para una semilla dada. */
export function flotaAleatoria(rng: Rng): Barco[] {
  const puestos: Barco[] = [];

  for (const tamano of TAMANOS_FLOTA) {
    for (let intento = 0; intento < INTENTOS_POR_BARCO; intento++) {
      const barco = alAzar(tamano, rng);
      if (cabe(barco, puestos)) {
        puestos.push(barco);
        break;
      }
    }
  }

  return puestos;
}

/**
 * A dónde dispara el bot.
 *
 * El orden importa: si hay un barco tocado y sin hundir, rematarlo es mejor que
 * cualquier tiro nuevo, así que el rastreo va primero y la paridad del
 * almirante solo entra cuando no queda nada que rematar. Al revés, el bot
 * dejaría barcos heridos por el tablero mientras sigue barriendo.
 */
export function siguienteDisparo(
  rejilla: readonly (Casilla | null)[],
  nivel: Nivel,
  rng: Rng,
): { fila: number; columna: number } {
  if (nivel !== 'novato') {
    const remates = contiguasATocado(rejilla);
    if (remates.length > 0) return celda(elegir(remates, rng));
  }

  const libres = sinDisparar(rejilla);
  const candidatas = nivel === 'almirante' ? conParidad(libres) : libres;

  return celda(elegir(candidatas.length > 0 ? candidatas : libres, rng));
}

function alAzar(tamano: number, rng: Rng): Barco {
  const orientacion = rng.next() < 0.5 ? 'horizontal' : 'vertical';
  return {
    tamano,
    orientacion,
    fila: rng.int(0, orientacion === 'vertical' ? LADO - tamano : LADO - 1),
    columna: rng.int(0, orientacion === 'horizontal' ? LADO - tamano : LADO - 1),
  };
}

/**
 * Las casillas sin disparar que tocan un impacto todavía a flote.
 *
 * Se miran las casillas en `tocado` y nunca las `hundido`: un barco que ya cayó
 * no tiene nada alrededor que valga la pena, y rastrearlo sería gastar turnos
 * en el agua de al lado.
 */
function contiguasATocado(rejilla: readonly (Casilla | null)[]): number[] {
  const vecinas = new Set<number>();

  for (let casilla = 0; casilla < rejilla.length; casilla++) {
    if (rejilla[casilla] !== 'tocado') continue;
    const fila = Math.floor(casilla / LADO);
    const columna = casilla % LADO;

    for (const vecina of alrededor(fila, columna)) {
      const pos = indice(vecina.fila, vecina.columna);
      if (rejilla[pos] === null) vecinas.add(pos);
    }
  }

  return [...vecinas].sort((a, b) => a - b);
}

function alrededor(fila: number, columna: number): { fila: number; columna: number }[] {
  return [
    { fila: fila - 1, columna },
    { fila: fila + 1, columna },
    { fila, columna: columna - 1 },
    { fila, columna: columna + 1 },
  ].filter(
    (celda) => celda.fila >= 0 && celda.fila < LADO && celda.columna >= 0 && celda.columna < LADO,
  );
}

function sinDisparar(rejilla: readonly (Casilla | null)[]): number[] {
  return rejilla.flatMap((casilla, pos) => (casilla === null ? [pos] : []));
}

/**
 * La mitad del tablero en damero.
 *
 * El barco más pequeño ocupa dos casillas, así que ninguno cabe entre dos
 * casillas de la misma paridad sin tocar una: barrer solo estas encuentra
 * cualquier barco con la mitad de disparos.
 */
function conParidad(casillas: readonly number[]): number[] {
  return casillas.filter((pos) => (Math.floor(pos / LADO) + (pos % LADO)) % 2 === 0);
}

function elegir(casillas: readonly number[], rng: Rng): number {
  return casillas[rng.int(0, casillas.length - 1)] ?? 0;
}

function celda(pos: number): { fila: number; columna: number } {
  return { fila: Math.floor(pos / LADO), columna: pos % LADO };
}
