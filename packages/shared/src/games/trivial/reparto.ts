import type { Momento } from './guion';

/**
 * El reparto del programa: el presentador y los personajes de la mesa.
 *
 * Las imágenes viven en `apps/web/public/assets/trivial`, pero el catálogo va
 * aquí porque el personaje que elige cada uno viaja con su asiento y lo
 * reparte el servidor: si viviera en la pantalla, cada jugador vería a los
 * demás con otra cara.
 */

/** Los gestos del presentador, tal y como se llaman sus ficheros. */
export const GESTOS = ['idle', 'talk', 'talk2', 'think', 'wrong', 'yes'] as const;

export type Gesto = (typeof GESTOS)[number];

/**
 * Qué cara pone en cada momento del programa.
 *
 * No es decoración: un presentador que pone la misma cara mientras te felicita
 * y mientras te estalla la bomba no está presentando nada. Los momentos que
 * son buenas noticias van con `yes`, los desastres con `wrong`, y los de
 * pensar -un marcador apretado, la última ronda- con `think`.
 */
const GESTO_POR_MOMENTO: Readonly<Record<Momento, Gesto>> = {
  bienvenida: 'talk',
  presentaRonda: 'talk2',
  aciertaAlguien: 'yes',
  nadieAcierta: 'wrong',
  empate: 'think',
  ultimaRonda: 'think',
  despedida: 'yes',

  seccionTest: 'talk',
  seccionEstimacion: 'think',
  seccionFallo: 'think',
  seccionPulsa: 'talk2',
  seccionRafaga: 'talk',
  seccionBomba: 'talk2',

  lider: 'talk2',
  remonta: 'yes',
  seHunde: 'wrong',
  pegados: 'think',
  rachaBuena: 'yes',

  pasaLaBomba: 'talk2',
  explota: 'wrong',
};

/**
 * La cara que toca. Sin momento -antes de empezar- se queda quieto.
 *
 * El acceso se tipa a mano porque el momento llega como texto desde el
 * servidor: si lo tratáramos como `Momento` sin más, el tipo diría que
 * siempre hay gesto, y uno que no conozcamos daría `undefined` en silencio.
 */
export function gestoDe(momento: string): Gesto {
  const conocidos: Readonly<Record<string, Gesto | undefined>> = GESTO_POR_MOMENTO;
  return conocidos[momento] ?? 'idle';
}

export function fotoDelPresentador(gesto: Gesto): string {
  return `/assets/trivial/host/${gesto}.png`;
}

/** Uno de los personajes que se puede elegir al sentarse. */
export interface Personaje {
  readonly id: string;
  readonly nombre: string;
  /** Una línea que se lee al elegirlo. Es lo que le da carácter. */
  readonly pinta: string;
}

/**
 * El reparto elegible.
 *
 * Once, que es más que asientos tiene una mesa: nadie debería quedarse sin
 * poder elegir porque otro haya cogido el suyo antes.
 */
export const REPARTO: readonly Personaje[] = [
  { id: 'atlas', nombre: 'Atlas', pinta: 'Aguanta el sistema entero sobre los hombros' },
  { id: 'bolt', nombre: 'Bolt', pinta: 'Contesta antes de leer la pregunta' },
  { id: 'drift', nombre: 'Drift', pinta: 'Va a su ritmo y suele llegar' },
  { id: 'ghost', nombre: 'Ghost', pinta: 'Nadie sabe de dónde ha salido' },
  { id: 'nova', nombre: 'Nova', pinta: 'Se lo juega todo a una carta' },
  { id: 'prof', nombre: 'Prof', pinta: 'Explica la respuesta aunque no se la pidas' },
  { id: 'sage', nombre: 'Sage', pinta: 'Lleva veinte años viendo caer producción' },
  { id: 'spark', nombre: 'Spark', pinta: 'Se le ocurre siempre otra manera' },
  { id: 'stack', nombre: 'Stack', pinta: 'Lo ha buscado todo y se acuerda de casi todo' },
  { id: 'tank', nombre: 'Tank', pinta: 'No se mueve hasta estar seguro' },
  { id: 'viper', nombre: 'Viper', pinta: 'Silenciosa hasta que te adelanta' },
];

export function personajePorId(id: string | null | undefined): Personaje | null {
  if (!id) return null;
  return REPARTO.find((uno) => uno.id === id) ?? null;
}

export function fotoDelPersonaje(id: string): string {
  return `/assets/trivial/cast/${id}.png`;
}

/**
 * Un personaje para quien no elige.
 *
 * Se reparte por el identificador del asiento y no al azar: así, quien entra
 * sin elegir sale siempre con el mismo y no le cambia la cara al recargar.
 */
export function personajePorDefecto(seatId: string): Personaje {
  let suma = 0;
  for (const letra of seatId) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
  return REPARTO[suma % REPARTO.length];
}

/** Un asiento, para repartirle cara. */
export interface AsientoConCara {
  readonly id: string;
  readonly personaje?: string | undefined;
}

/**
 * Reparte las caras de la mesa sin que se repita ninguna.
 *
 * Lo que cada uno eligió manda; a los demás -los bots, y quien entró sin
 * elegir- se les da el suyo por defecto y, si ya lo tiene otro, el siguiente
 * libre. Dos jugadores con la misma cara en el marcador se confunden a la
 * primera, y en la bomba es peor: no se sabe quién la tiene.
 */
export function repartirCaras(asientos: readonly AsientoConCara[]): Record<string, string> {
  const dadas = new Map<string, string>();
  const cogidas = new Set<string>();

  // Primero los que eligieron: su elección no se le quita nadie.
  for (const asiento of asientos) {
    const suyo = personajePorId(asiento.personaje);
    if (suyo && !cogidas.has(suyo.id)) {
      dadas.set(asiento.id, suyo.id);
      cogidas.add(suyo.id);
    }
  }

  // Y a los demás, el suyo por defecto o el primero libre a partir de ahí.
  for (const asiento of asientos) {
    if (dadas.has(asiento.id)) continue;
    const elegido = primeroLibreDesde(personajePorDefecto(asiento.id), cogidas);
    dadas.set(asiento.id, elegido.id);
    cogidas.add(elegido.id);
  }

  return Object.fromEntries(dadas);
}

/**
 * El primero libre dando la vuelta al reparto desde ese.
 *
 * Si están todos cogidos -más asientos que personajes- devuelve el de partida
 * y se repite. No es un problema real: no caben tantos en una mesa.
 */
function primeroLibreDesde(desde: Personaje, cogidas: ReadonlySet<string>): Personaje {
  const inicio = REPARTO.indexOf(desde);
  for (let paso = 0; paso < REPARTO.length; paso++) {
    const candidato = REPARTO[(inicio + paso) % REPARTO.length];
    if (!cogidas.has(candidato.id)) return candidato;
  }
  return desde;
}
