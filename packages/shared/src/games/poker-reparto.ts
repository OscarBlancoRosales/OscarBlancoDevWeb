/**
 * Quién se sienta a la mesa de planning poker y quién la dirige.
 *
 * Las imágenes viven en `apps/web/public/assets/poker`, pero el catálogo va
 * aquí porque el avatar que elige cada uno viaja con su asiento: si viviera en
 * la pantalla, cada jugador vería a los demás con otra cara.
 */

/** Los gestos del dealer, tal y como se llaman sus ficheros. */
export const GESTOS_DEALER = [
  'idle',
  'deal',
  'talk',
  'talk2',
  'think',
  'yes',
  'no',
  'wink',
  'sip',
  'joy',
  'laugh',
  'sarcastic',
  'shock',
  'disappointed',
  'angry',
  'rage',
] as const;

export type GestoDealer = (typeof GESTOS_DEALER)[number];

/**
 * Los momentos en los que el dealer abre la boca.
 *
 * No habla por hablar: habla cuando pasa algo. Repartir, meter prisa al que se
 * ha quedado mirando el techo, cantar el resultado y, sobre todo, señalar al
 * que ha votado veintiuno cuando el resto votaba tres.
 */
export const MOMENTOS_DEALER = [
  'reparte',
  'primerVoto',
  'faltaGente',
  'espabila',
  'todosListos',
  'acuerdoTotal',
  'consenso',
  'dispersion',
  'desacuerdo',
  'elDesviado',
  'dosBandos',
  'cafe',
  'porro',
  'nuevaRonda',
] as const;

export type MomentoDealer = (typeof MOMENTOS_DEALER)[number];

/**
 * Qué cara pone en cada momento.
 *
 * El personaje es un tipo con melenas, gafas de sol y un cubata en la mano: el
 * repertorio va del guiño a la mala leche, y la cara tiene que ir con lo que
 * dice. Cuando pide explicaciones a quien se ha ido de madre, sarcástico; y
 * cuando lleva un rato esperando a que alguien vote, cabreado.
 */
const GESTO_POR_MOMENTO: Readonly<Record<MomentoDealer, GestoDealer>> = {
  reparte: 'deal',
  primerVoto: 'wink',
  faltaGente: 'think',
  espabila: 'angry',
  todosListos: 'talk',
  acuerdoTotal: 'joy',
  consenso: 'yes',
  dispersion: 'think',
  desacuerdo: 'shock',
  elDesviado: 'sarcastic',
  dosBandos: 'no',
  cafe: 'sip',
  porro: 'laugh',
  nuevaRonda: 'talk2',
};

/** La cara que toca. Sin momento, el dealer espera tan tranquilo. */
export function gestoDelDealer(momento: string): GestoDealer {
  const conocidos: Readonly<Record<string, GestoDealer | undefined>> = GESTO_POR_MOMENTO;
  return conocidos[momento] ?? 'idle';
}

export function fotoDelDealer(gesto: GestoDealer): string {
  return `/assets/poker/dealer/${gesto}.png`;
}

/** Un avatar de los que se pueden elegir para sentarse. */
export interface AvatarDeMesa {
  readonly id: string;
  readonly nombre: string;
  /** De qué grupo sale, para poder enseñarlos separados al elegir. */
  readonly grupo: 'leyendas' | 'iconos';
}

/**
 * Las leyendas: gente de verdad de la historia de la informática, más algún
 * personaje de internet. Son las que apetece coger.
 */
const LEYENDAS: readonly AvatarDeMesa[] = [
  { id: 'turing', nombre: 'Turing', grupo: 'leyendas' },
  { id: 'hopper', nombre: 'Hopper', grupo: 'leyendas' },
  { id: 'hamilton', nombre: 'Hamilton', grupo: 'leyendas' },
  { id: 'timbl', nombre: 'Berners-Lee', grupo: 'leyendas' },
  { id: 'stallman', nombre: 'Stallman', grupo: 'leyendas' },
  { id: 'linus', nombre: 'Linus', grupo: 'leyendas' },
  { id: 'guido', nombre: 'Guido', grupo: 'leyendas' },
  { id: 'jobs', nombre: 'Jobs', grupo: 'leyendas' },
  { id: 'gates', nombre: 'Gates', grupo: 'leyendas' },
  { id: 'satoshi', nombre: 'Satoshi', grupo: 'leyendas' },
  { id: 'bezos', nombre: 'Bezos', grupo: 'leyendas' },
  { id: 'musk', nombre: 'Musk', grupo: 'leyendas' },
  { id: 'zuck', nombre: 'Zuck', grupo: 'leyendas' },
  { id: 'hackerman', nombre: 'Hackerman', grupo: 'leyendas' },
  { id: 'neckbeard', nombre: 'Neckbeard', grupo: 'leyendas' },
  { id: 'anon', nombre: 'Anónimo', grupo: 'leyendas' },
];

/** Y los iconos de siempre, para quien prefiere no ponerle cara a nadie. */
const ICONOS: readonly AvatarDeMesa[] = [
  { id: 'ada', nombre: 'Ada', grupo: 'iconos' },
  { id: 'cafe', nombre: 'Café', grupo: 'iconos' },
  { id: 'cursor', nombre: 'Cursor', grupo: 'iconos' },
  { id: 'duck', nombre: 'El pato', grupo: 'iconos' },
  { id: 'enigma', nombre: 'Enigma', grupo: 'iconos' },
  { id: 'floppy', nombre: 'Disquete', grupo: 'iconos' },
  { id: 'kernel', nombre: 'Kernel', grupo: 'iconos' },
  { id: 'lambda', nombre: 'Lambda', grupo: 'iconos' },
  { id: 'navy', nombre: 'Navy', grupo: 'iconos' },
  { id: 'null', nombre: 'Null', grupo: 'iconos' },
  { id: 'pixel', nombre: 'Píxel', grupo: 'iconos' },
  { id: 'serpent', nombre: 'Serpiente', grupo: 'iconos' },
  { id: 'wizard', nombre: 'El mago', grupo: 'iconos' },
];

export const AVATARES: readonly AvatarDeMesa[] = [...LEYENDAS, ...ICONOS];

export function avatarPorId(id: string | null | undefined): AvatarDeMesa | null {
  if (!id) return null;
  return AVATARES.find((uno) => uno.id === id) ?? null;
}

export function fotoDelAvatar(id: string): string {
  const avatar = avatarPorId(id);
  const carpeta = avatar?.grupo === 'iconos' ? 'avatars' : 'legends';
  return `/assets/poker/${carpeta}/${id}.png`;
}

/**
 * El avatar de quien no elige.
 *
 * Se reparte por el identificador del asiento y no al azar: quien entra sin
 * elegir sale siempre con el mismo y no le cambia la cara al recargar.
 */
export function avatarPorDefecto(seatId: string): AvatarDeMesa {
  let suma = 0;
  for (const letra of seatId) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
  return AVATARES[suma % AVATARES.length];
}

/** Un asiento al que hay que ponerle cara. */
export interface AsientoDeMesa {
  readonly id: string;
  readonly avatar?: string | undefined;
}

/**
 * Reparte las caras de la mesa sin que se repita ninguna.
 *
 * Lo que cada uno eligió manda; al resto se le da el suyo por defecto y, si ya
 * está cogido, el siguiente libre. Dos personas con la misma cara alrededor de
 * una mesa de poker no se distinguen, y el dealer acabaría pidiéndole cuentas
 * a quien no era.
 */
export function repartirAvatares(asientos: readonly AsientoDeMesa[]): Record<string, string> {
  const dadas = new Map<string, string>();
  const cogidas = new Set<string>();

  for (const asiento of asientos) {
    const suyo = avatarPorId(asiento.avatar);
    if (suyo && !cogidas.has(suyo.id)) {
      dadas.set(asiento.id, suyo.id);
      cogidas.add(suyo.id);
    }
  }

  for (const asiento of asientos) {
    if (dadas.has(asiento.id)) continue;
    const elegido = primeroLibreDesde(avatarPorDefecto(asiento.id), cogidas);
    dadas.set(asiento.id, elegido.id);
    cogidas.add(elegido.id);
  }

  return Object.fromEntries(dadas);
}

/**
 * El primero libre dando la vuelta al catálogo desde ese.
 *
 * Si están todos cogidos devuelve el de partida y se repite. Con veintinueve
 * avatares y mesas de ocho, no pasa.
 */
function primeroLibreDesde(desde: AvatarDeMesa, cogidas: ReadonlySet<string>): AvatarDeMesa {
  const inicio = AVATARES.indexOf(desde);
  for (let paso = 0; paso < AVATARES.length; paso++) {
    const candidato = AVATARES[(inicio + paso) % AVATARES.length];
    if (!cogidas.has(candidato.id)) return candidato;
  }
  return desde;
}

/**
 * Dónde se sienta cada uno alrededor de la mesa.
 *
 * Reparte los asientos por el óvalo dejando la parte de abajo libre para ti:
 * en una mesa de verdad uno no se ve a sí mismo enfrente. Devuelve tantos por
 * cientos, que es lo que la pantalla necesita para colocarlos.
 */
export function sitiosEnLaMesa(cuantos: number): { x: number; y: number }[] {
  if (cuantos <= 0) return [];

  const sitios: { x: number; y: number }[] = [];
  for (let i = 0; i < cuantos; i++) {
    // Una herradura: se empieza abajo a la izquierda, se sube por el lado, se
    // cruza por arriba y se baja por la derecha. El hueco de abajo en medio se
    // queda libre a propósito, que es donde estás tú.
    const angulo = Math.PI * (1.15 - (1.3 * i) / Math.max(1, cuantos - 1));
    sitios.push({
      x: redondearPorciento(50 + 42 * Math.cos(angulo)),
      y: redondearPorciento(52 - 40 * Math.sin(angulo)),
    });
  }
  return sitios;
}

function redondearPorciento(valor: number): number {
  return Math.round(valor * 10) / 10;
}
