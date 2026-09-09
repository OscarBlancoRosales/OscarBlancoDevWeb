/**
 * El elenco del Impostor: memes de toda la vida.
 *
 * Las imágenes viven en `apps/web/public/assets/impostor/cast`, pero el
 * catálogo va aquí porque la cara que elige cada uno viaja con su asiento y la
 * reparte el servidor: si viviera en la pantalla, cada jugador vería a los
 * demás con otra cara y señalar «el pingüino» dejaría de significar nada.
 *
 * En este juego la cara importa más que en ningún otro: la partida entera es
 * acusarse por turnos, y se acusa a una cara, no a un identificador.
 */

export interface Cara {
  readonly id: string;
  readonly nombre: string;
  /** Una línea que se lee al elegirla. Es lo que le da carácter. */
  readonly pinta: string;
}

export const ELENCO: readonly Cara[] = [
  { id: 'troll', nombre: 'Troll', pinta: 'Heh. Problem?' },
  { id: 'doge', nombre: 'Doge', pinta: 'Much sospechoso. Very impostor.' },
  { id: 'alone', nombre: 'Forever', pinta: 'Nadie le cree. Nadie. Nunca.' },
  { id: 'fine', nombre: 'Fine', pinta: 'Todo arde y él sigue con el café.' },
  { id: 'gusta', nombre: 'Me Gusta', pinta: 'Le gusta que le acusen. Demasiado.' },
  { id: 'rage', nombre: 'Rage', pinta: 'Le votan y se le oye desde la calle.' },
  { id: 'wojak', nombre: 'Wojak', pinta: 'Sabe que es el impostor. Le duele.' },
  { id: 'chad', nombre: 'Chad', pinta: 'Sí. Era yo. Siguiente ronda.' },
  { id: 'stonks', nombre: 'Stonks', pinta: 'Acusar al inocente. Stonks.' },
  { id: 'cheems', nombre: 'Cheems', pinta: 'N-no p-puede ser el imp-postor.' },
  { id: 'npc', nombre: 'NPC', pinta: 'Dice la misma pista tres veces.' },
  { id: 'sir', nombre: 'Sir', pinta: 'Caballeros, esta mesa huele a traición.' },
  { id: 'yuno', nombre: 'Y U NO', pinta: '¿POR QUÉ NO VOTAS CON EL GRUPO?' },
  { id: 'cereal', nombre: 'Cereal', pinta: 'Se enteró tarde. La cuchara sigue arriba.' },
  { id: 'okay', nombre: 'Okay', pinta: 'Le expulsan. Okay.' },
  { id: 'penguin', nombre: 'Penguin', pinta: 'Quiso acusar. Sudó. Se calló.' },
  { id: 'raptor', nombre: 'Raptor', pinta: 'Si el impostor es inocente, ¿quién miente?' },
  { id: 'datboi', nombre: 'Dat Boi', pinta: 'Aquí llega. Y se va por donde vino.' },
  { id: 'bongo', nombre: 'Bongo', pinta: 'No habla. Solo bongos. Muy sospechoso.' },
  { id: 'doomer', nombre: 'Doomer', pinta: 'Da igual quién gane. Enciende otro.' },
  { id: 'soyjak', nombre: 'Soyjak', pinta: '¡ERA ÉL! ¡ERA ÉL! ¡MIRAD LA PISTA!' },
  { id: 'deal', nombre: 'Deal', pinta: 'Le pillan y se pone las gafas.' },
  { id: 'moai', nombre: 'Moai', pinta: 'No dice nada. El silencio es el chiste.' },
  { id: 'floppa', nombre: 'Floppa', pinta: 'Gato grande. Sospecha más grande.' },
];

export function caraPorId(id: string | null | undefined): Cara | null {
  if (!id) return null;
  return ELENCO.find((una) => una.id === id) ?? null;
}

export function fotoDeLaCara(id: string): string {
  return `/assets/impostor/cast/${id}.png`;
}

/**
 * Una cara para quien no elige.
 *
 * Se reparte por el identificador del asiento y no al azar: así, quien entra
 * sin elegir sale siempre con la misma y no le cambia la cara al recargar.
 */
export function caraPorDefecto(seatId: string): Cara {
  let suma = 0;
  for (const letra of seatId) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
  return ELENCO[suma % ELENCO.length];
}

/** Un asiento, para repartirle cara. */
export interface AsientoConCara {
  readonly id: string;
  readonly cara?: string | undefined;
}

/**
 * Reparte las caras de la mesa sin que se repita ninguna.
 *
 * Lo que cada uno eligió manda; a los demás —los bots, y quien entró sin
 * elegir— se les da la suya por defecto y, si ya la tiene otro, la siguiente
 * libre. Dos jugadores con la misma cara serían un desastre en un juego que
 * consiste en decir «ha sido ese».
 */
export function repartirCaras(asientos: readonly AsientoConCara[]): Record<string, string> {
  const dadas = new Map<string, string>();
  const cogidas = new Set<string>();

  // Primero los que eligieron: su elección no se la quita nadie.
  for (const asiento of asientos) {
    const suya = caraPorId(asiento.cara);
    if (suya && !cogidas.has(suya.id)) {
      dadas.set(asiento.id, suya.id);
      cogidas.add(suya.id);
    }
  }

  for (const asiento of asientos) {
    if (dadas.has(asiento.id)) continue;
    const elegida = primeraLibreDesde(caraPorDefecto(asiento.id), cogidas);
    dadas.set(asiento.id, elegida.id);
    cogidas.add(elegida.id);
  }

  return Object.fromEntries(dadas);
}

/**
 * La primera libre dando la vuelta al elenco desde esa.
 *
 * Si están todas cogidas —más asientos que caras— devuelve la de partida y se
 * repite. Con veinticuatro caras y dieciséis asientos como mucho, no pasa.
 */
function primeraLibreDesde(desde: Cara, cogidas: ReadonlySet<string>): Cara {
  const inicio = ELENCO.indexOf(desde);
  for (let paso = 0; paso < ELENCO.length; paso++) {
    const candidata = ELENCO[(inicio + paso) % ELENCO.length];
    if (!cogidas.has(candidata.id)) return candidata;
  }
  return desde;
}
