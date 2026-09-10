import type { ScrumVote } from './scrum';
import type { SeatId } from './module';

/**
 * Lo que la mesa dice de una votación: la media, lo repartidos que van los
 * votos y quién se ha salido del corro.
 *
 * Vivía dentro del componente de la pantalla, mezclado con el pintado, así que
 * la versión nueva del planning poker no podía usarlo sin copiarlo entero. Y
 * además es justo lo que más merece tener pruebas: una desviación mal contada
 * señala a la persona equivocada delante de todo el equipo.
 *
 * No sabe nada del DOM ni de asientos: recibe votos y devuelve números.
 */

/** A partir de aquí, un voto es de otro planeta y se señala en rojo. */
export const DESVIO_GRAVE = 2;
/** Y a partir de aquí, se separa del grupo lo justo para comentarlo. */
export const DESVIO_LEVE = 1;

/**
 * Y además tiene que separarse esto en puntos, no solo en desviaciones.
 *
 * Con la mesa casi de acuerdo -cinco, cinco y seis- la desviación típica es
 * minúscula, así que un voto de seis sale a tres desviaciones de la media y el
 * z-score lo canta como si fuera de otro planeta. Pedirle explicaciones a
 * alguien por votar un seis cuando los demás votaron cinco es ridículo, así
 * que hace falta una distancia de verdad, no solo estadística.
 */
export const DIFERENCIA_MINIMA = 2;

/** Cuándo se considera que la mesa está de acuerdo. */
export const SIGMA_CONSENSO = 1.5;
export const SIGMA_DISPERSION = 3;

export type Acuerdo = 'esperando' | 'total' | 'consenso' | 'dispersion' | 'desacuerdo';

export interface Estadistica {
  /** Cuántos han votado un número. Cafés y porros no cuentan para la media. */
  readonly votantes: number;
  readonly media: number;
  readonly mediana: number;
  readonly desviacion: number;
  readonly minimo: number;
  readonly maximo: number;
  readonly acuerdo: Acuerdo;
}

/** Un voto numérico de alguien, que es lo único que entra en las cuentas. */
export interface VotoNumerico {
  readonly seatId: SeatId;
  readonly valor: number;
}

/** Los votos que son números. El café y el porro no se promedian. */
export function numericos(votos: Readonly<Record<SeatId, ScrumVote>>): VotoNumerico[] {
  return Object.entries(votos)
    .filter(([, voto]) => voto.tipo === 'numero')
    .map(([seatId, voto]) => ({ seatId, valor: voto.tipo === 'numero' ? voto.valor : 0 }));
}

/**
 * Las cuentas de la ronda.
 *
 * Con menos de dos votos no hay nada que promediar y se devuelve `esperando`:
 * una desviación calculada sobre un solo voto es siempre cero, y enseñar
 * «consenso total» porque ha votado uno solo es mentir.
 */
export function estadisticaDe(votos: readonly VotoNumerico[]): Estadistica {
  const valores = votos.map((uno) => uno.valor);
  if (valores.length === 0) {
    return {
      votantes: 0,
      media: 0,
      mediana: 0,
      desviacion: 0,
      minimo: 0,
      maximo: 0,
      acuerdo: 'esperando',
    };
  }

  const media = redondear(valores.reduce((suma, uno) => suma + uno, 0) / valores.length);
  const cuadrados = valores.map((uno) => (uno - media) ** 2);
  const desviacion = redondear(
    Math.sqrt(cuadrados.reduce((suma, uno) => suma + uno, 0) / valores.length),
  );

  return {
    votantes: valores.length,
    media,
    mediana: medianaDe(valores),
    desviacion,
    minimo: Math.min(...valores),
    maximo: Math.max(...valores),
    acuerdo: acuerdoCon(valores.length, desviacion),
  };
}

/**
 * Cuánto se sale del corro ese voto, en desviaciones típicas.
 *
 * Con la mesa de acuerdo -desviación cero- nadie se desvía, aunque el número
 * sea distinto: si los cinco votaron cinco, no hay de qué hablar.
 */
export function desvioDe(valor: number, stats: Estadistica): number {
  if (stats.desviacion === 0) return 0;
  return Math.abs(valor - stats.media) / stats.desviacion;
}

/** Quién se ha desviado más, que es a quien hay que pedirle explicaciones. */
export function elMasDesviado(
  votos: readonly VotoNumerico[],
  stats: Estadistica,
): VotoNumerico | null {
  if (votos.length < 2 || stats.desviacion === 0) return null;

  let peor: VotoNumerico | null = null;
  let suyo = 0;
  for (const voto of votos) {
    const desvio = desvioDe(voto.valor, stats);
    if (desvio > suyo) {
      peor = voto;
      suyo = desvio;
    }
  }

  if (!peor || suyo < DESVIO_LEVE) return null;
  return Math.abs(peor.valor - stats.media) >= DIFERENCIA_MINIMA ? peor : null;
}

/**
 * Si la mesa se ha partido en dos bandos en vez de repartirse.
 *
 * No es lo mismo que haya dispersión a que haya dos grupos: cinco votos
 * repartidos de uno a ocho es duda, y tres votos de uno y tres de trece son
 * dos maneras distintas de entender la tarea. Lo segundo hay que hablarlo.
 */
export function hayDosBandos(votos: readonly VotoNumerico[]): boolean {
  const bandos = bandosDe(votos);
  return bandos !== null;
}

export interface Bandos {
  readonly bajos: readonly VotoNumerico[];
  readonly altos: readonly VotoNumerico[];
}

/**
 * Los dos grupos, si los hay.
 *
 * Se parte por el hueco más grande entre votos consecutivos, y solo cuenta si
 * ese hueco es mayor que la mitad del recorrido: si no, es un reparto continuo
 * y partirlo sería inventarse una división que no existe.
 */
export function bandosDe(votos: readonly VotoNumerico[]): Bandos | null {
  if (votos.length < 4) return null;

  const ordenados = [...votos].sort((uno, otro) => uno.valor - otro.valor);
  const recorrido = ordenados[ordenados.length - 1].valor - ordenados[0].valor;
  if (recorrido === 0) return null;

  let corte = 0;
  let hueco = 0;
  for (let i = 1; i < ordenados.length; i++) {
    const salto = ordenados[i].valor - ordenados[i - 1].valor;
    if (salto > hueco) {
      hueco = salto;
      corte = i;
    }
  }

  if (hueco <= recorrido / 2) return null;
  return { bajos: ordenados.slice(0, corte), altos: ordenados.slice(corte) };
}

function acuerdoCon(votantes: number, desviacion: number): Acuerdo {
  if (votantes < 2) return 'esperando';
  if (desviacion === 0) return 'total';
  if (desviacion < SIGMA_CONSENSO) return 'consenso';
  if (desviacion < SIGMA_DISPERSION) return 'dispersion';
  return 'desacuerdo';
}

function medianaDe(valores: readonly number[]): number {
  const ordenados = [...valores].sort((uno, otro) => uno - otro);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? redondear((ordenados[medio - 1] + ordenados[medio]) / 2)
    : ordenados[medio];
}

/** Dos decimales: un 3.3333333 en pantalla no dice más que un 3.33. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
