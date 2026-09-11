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
 * La forma de la mesa, en por cientos del hueco que ocupa.
 *
 * Un rectángulo con las esquinas redondeadas, que es la forma de una mesa de
 * poker de verdad: lados rectos y esquinas comidas. Y es **la misma forma que
 * dibuja el CSS** con su `border-radius`, no una parecida: si aquí se repartiera
 * por un óvalo y allí se pintara un rectángulo, la gente se sentaría flotando
 * fuera del tapete por las esquinas.
 */
const CENTRO_X = 50;
const CENTRO_Y = 50;
const RADIO_X = 46;
const RADIO_Y = 40;
/** Lo redondas que son las esquinas, en por cientos de cada eje. */
const ESQUINA_X = 16;
const ESQUINA_Y = 18;

/** Cuántos trozos se parte cada esquina para medirla. Más, ni se nota. */
const TROZOS_DE_ESQUINA = 48;

/**
 * Dónde se sienta cada uno alrededor de la mesa.
 *
 * El primero es **tu sitio**: abajo en el centro, que es donde se sienta uno en
 * una mesa de verdad. A partir de ahí se reparte el resto por el borde en el
 * sentido de las agujas del reloj, repartidos por distancia recorrida y no por
 * ángulo: en un rectángulo, repartir por ángulo amontona a la gente en las
 * esquinas y deja los lados largos vacíos.
 *
 * Devuelve por cientos, que es lo que la pantalla necesita para colocarlos.
 */
export function sitiosEnLaMesa(cuantos: number): { x: number; y: number }[] {
  if (cuantos <= 0) return [];

  const borde = medirElBorde();
  // `.at()` dice la verdad -una lista puede estar vacía- y así la comprobación
  // que de verdad hace falta no parece que sobre.
  const vuelta = borde.at(-1)?.recorrido ?? 0;

  const sitios: { x: number; y: number }[] = [];
  for (let i = 0; i < cuantos; i++) {
    sitios.push(enElBorde(borde, (vuelta * i) / cuantos));
  }
  return sitios;
}

/** Un punto del borde con lo que se lleva recorrido hasta él. */
interface PuntoDelBorde {
  readonly x: number;
  readonly y: number;
  readonly recorrido: number;
}

/**
 * Recorre el borde de la mesa midiéndolo.
 *
 * Empieza abajo en el centro y da la vuelta en el sentido de las agujas del
 * reloj: media base hacia la izquierda, el lado izquierdo hacia arriba, el
 * techo hacia la derecha, el lado derecho hacia abajo y la otra media base.
 */
function medirElBorde(): PuntoDelBorde[] {
  const izquierda = CENTRO_X - RADIO_X;
  const derecha = CENTRO_X + RADIO_X;
  const arriba = CENTRO_Y - RADIO_Y;
  const abajo = CENTRO_Y + RADIO_Y;

  const camino: { x: number; y: number }[] = [{ x: CENTRO_X, y: abajo }];
  const recta = (x: number, y: number): void => void camino.push({ x, y });
  const esquina = (cx: number, cy: number, desde: number, hasta: number): void => {
    for (let i = 1; i <= TROZOS_DE_ESQUINA; i++) {
      const angulo = desde + ((hasta - desde) * i) / TROZOS_DE_ESQUINA;
      camino.push({
        x: cx + ESQUINA_X * Math.cos(angulo),
        y: cy + ESQUINA_Y * Math.sin(angulo),
      });
    }
  };

  recta(izquierda + ESQUINA_X, abajo);
  esquina(izquierda + ESQUINA_X, abajo - ESQUINA_Y, Math.PI / 2, Math.PI);
  recta(izquierda, arriba + ESQUINA_Y);
  esquina(izquierda + ESQUINA_X, arriba + ESQUINA_Y, Math.PI, (3 * Math.PI) / 2);
  recta(derecha - ESQUINA_X, arriba);
  esquina(derecha - ESQUINA_X, arriba + ESQUINA_Y, (3 * Math.PI) / 2, 2 * Math.PI);
  recta(derecha, abajo - ESQUINA_Y);
  esquina(derecha - ESQUINA_X, abajo - ESQUINA_Y, 0, Math.PI / 2);
  recta(CENTRO_X, abajo);

  const medidos: PuntoDelBorde[] = [];
  let recorrido = 0;
  let anterior: { x: number; y: number } | null = null;

  for (const punto of camino) {
    if (anterior !== null) recorrido += Math.hypot(punto.x - anterior.x, punto.y - anterior.y);
    medidos.push({ ...punto, recorrido });
    anterior = punto;
  }
  return medidos;
}

/** El punto que queda a esa distancia del arranque, interpolando entre muestras. */
function enElBorde(borde: readonly PuntoDelBorde[], distancia: number): { x: number; y: number } {
  for (let i = 1; i < borde.length; i++) {
    const antes = borde[i - 1];
    const ahora = borde[i];
    if (ahora.recorrido < distancia) continue;

    const tramo = ahora.recorrido - antes.recorrido;
    const cuanto = tramo > 0 ? (distancia - antes.recorrido) / tramo : 0;
    return {
      x: redondearPorciento(antes.x + (ahora.x - antes.x) * cuanto),
      y: redondearPorciento(antes.y + (ahora.y - antes.y) * cuanto),
    };
  }

  // Pasado el final se devuelve el último punto. No debería llegar aquí -las
  // distancias salen de la propia vuelta- pero un sitio en el centro de la mesa
  // se ve raro y una excepción se ve peor.
  const ultimo = borde.at(-1);
  return ultimo
    ? { x: redondearPorciento(ultimo.x), y: redondearPorciento(ultimo.y) }
    : { x: CENTRO_X, y: CENTRO_Y };
}

function redondearPorciento(valor: number): number {
  return Math.round(valor * 10) / 10;
}
