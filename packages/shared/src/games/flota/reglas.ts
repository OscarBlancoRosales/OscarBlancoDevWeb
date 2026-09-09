import { LADO, TAMANOS_FLOTA } from './tipos';
import type { Barco, Bando, Casilla, Punteria } from './tipos';
import type { RuleError } from '../module';

/** La casilla de la rejilla que corresponde a una fila y una columna. */
export function indice(fila: number, columna: number): number {
  return fila * LADO + columna;
}

export function tableroVacio(): (Casilla | null)[] {
  return Array.from({ length: LADO * LADO }, () => null);
}

export function celdasDe(barco: Barco): { fila: number; columna: number }[] {
  return Array.from({ length: barco.tamano }, (_, paso) =>
    barco.orientacion === 'horizontal'
      ? { fila: barco.fila, columna: barco.columna + paso }
      : { fila: barco.fila + paso, columna: barco.columna },
  );
}

export function dentroDelTablero(fila: number, columna: number): boolean {
  return fila >= 0 && fila < LADO && columna >= 0 && columna < LADO;
}

/** Si ese barco cabe donde lo ponen sin montarse encima de los ya puestos. */
export function cabe(barco: Barco, puestos: readonly Barco[]): boolean {
  const ocupadas = ocupacion(puestos);
  return celdasDe(barco).every(
    (celda) =>
      dentroDelTablero(celda.fila, celda.columna) &&
      !ocupadas.has(indice(celda.fila, celda.columna)),
  );
}

/**
 * Si una flota entera es legal.
 *
 * Los barcos pueden tocarse: lo único prohibido es solapar. La alternativa —un
 * hueco obligatorio alrededor de cada barco— recorta tanto las colocaciones
 * posibles en un tablero de diez que convierte al bot en adivino.
 */
export function validarFlota(barcos: readonly Barco[]): RuleError | null {
  if (!tamanosCorrectos(barcos)) {
    return { code: 'flota-incompleta', message: 'Esa no es la flota que toca.' };
  }

  const ocupadas = new Set<number>();
  for (const barco of barcos) {
    for (const celda of celdasDe(barco)) {
      if (!dentroDelTablero(celda.fila, celda.columna)) {
        return { code: 'barco-fuera', message: 'Ese barco no cabe en el tablero.' };
      }
      const pos = indice(celda.fila, celda.columna);
      if (ocupadas.has(pos)) {
        return { code: 'barcos-solapados', message: 'Dos barcos ocupan la misma casilla.' };
      }
      ocupadas.add(pos);
    }
  }
  return null;
}

export function barcoEn(barcos: readonly Barco[], fila: number, columna: number): Barco | null {
  return (
    barcos.find((barco) =>
      celdasDe(barco).some((celda) => celda.fila === fila && celda.columna === columna),
    ) ?? null
  );
}

/**
 * Un disparo sobre un bando, sin tocar el original.
 *
 * El resultado no se decide casilla a casilla sino barco a barco: mientras al
 * barco le quede algo en pie todas sus casillas heridas son «tocado», y cuando
 * cae la última pasan a «hundido» de golpe. Es lo que deja leer el tamaño del
 * barco en la rejilla sin que el servidor tenga que decir de cuál se trataba.
 */
export function disparar(
  bando: Bando,
  fila: number,
  columna: number,
): { bando: Bando; resultado: Casilla } {
  const recibidos = [...bando.recibidos];
  const barco = barcoEn(bando.barcos, fila, columna);

  if (!barco) {
    recibidos[indice(fila, columna)] = 'agua';
    return { bando: { ...bando, recibidos }, resultado: 'agua' };
  }

  recibidos[indice(fila, columna)] = 'tocado';
  const celdas = celdasDe(barco);
  const sigueAFlote = celdas.some(
    (celda) => recibidos[indice(celda.fila, celda.columna)] === null,
  );
  if (sigueAFlote) {
    return { bando: { ...bando, recibidos }, resultado: 'tocado' };
  }

  for (const celda of celdas) recibidos[indice(celda.fila, celda.columna)] = 'hundido';
  return { bando: { ...bando, recibidos }, resultado: 'hundido' };
}

export function flotaHundida(bando: Bando): boolean {
  return bando.barcos.every((barco) =>
    celdasDe(barco).every((celda) => bando.recibidos[indice(celda.fila, celda.columna)] !== null),
  );
}

/** La puntería de quien ha estado disparando a este bando. */
export function punteria(bando: Bando): Punteria {
  const caidos = bando.recibidos.filter((casilla) => casilla !== null);
  const aciertos = caidos.filter((casilla) => casilla !== 'agua').length;
  return {
    disparos: caidos.length,
    aciertos,
    porcentaje: caidos.length === 0 ? 0 : Math.round((aciertos / caidos.length) * 100),
  };
}

function ocupacion(barcos: readonly Barco[]): Set<number> {
  return new Set(
    barcos.flatMap((barco) => celdasDe(barco).map((celda) => indice(celda.fila, celda.columna))),
  );
}

/**
 * Si los barcos son exactamente los de la flota.
 *
 * Se comparan las dos listas ordenadas porque la flota es un multiconjunto: hay
 * dos barcos de tres, y perder uno de ellos no puede colar por el hecho de que
 * el tamaño siga apareciendo.
 */
function tamanosCorrectos(barcos: readonly Barco[]): boolean {
  const suyos = barcos.map((barco) => barco.tamano).sort((a, b) => b - a);
  const esperados = [...TAMANOS_FLOTA].sort((a, b) => b - a);
  return suyos.length === esperados.length && suyos.every((tamano, i) => tamano === esperados[i]);
}
