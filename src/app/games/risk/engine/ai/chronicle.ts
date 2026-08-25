import { GameMap, GameState, PlayerId, TerritoryId } from '../types';
import { Rng } from '../rng';
import { terrainOf } from '../terrain';

/**
 * Crónica de guerra del escenario de 1936.
 *
 * Cada ataque se cuenta como lo contaría un corresponsal: qué se está
 * intentando, por dónde, y qué pasó de verdad en ese sitio. La gracia está en la
 * PAREJA de provincias, igual que en el combate: no es lo mismo entrar en
 * Badajoz desde Cáceres que desde Sevilla, ni cruzar el Estrecho que bajar de
 * Navarra.
 *
 * ### Cómo se trata la historia
 *
 * Los episodios reales llevan marcado qué bando los protagonizó. Si en la
 * partida ataca ese mismo bando, la crónica lo cuenta como ocurrió. Si ataca el
 * otro, lo cuenta como lo que es —una historia que se tuerce— y dice qué se
 * está evitando. Eso es lo que hace que el escenario no sea un mapa pintado sino
 * una partida que dialoga con lo que pasó.
 *
 * Se habla de campañas, frentes y unidades: de lo militar. Los episodios de
 * represión contra la población civil, que los hubo por los dos lados y son lo
 * más serio de aquella guerra, no se convierten aquí en material de juego.
 *
 * La función es PURA: mismo estado, misma acción y misma tirada dan siempre el
 * mismo texto, así que todos los clientes que reproduzcan el log leen la misma
 * crónica.
 */

export interface ChronicleEvent {
  /** Desde dónde tiene que venir el ataque (vacío = desde cualquier sitio). */
  from?: TerritoryId[];
  /** A dónde va. */
  to: TerritoryId[];
  /** Bando que lo protagonizó de verdad. */
  side: 'republica' | 'sublevados';
  /** Cómo se cuenta cuando lo hace quien lo hizo. */
  asItWas: string;
  /** Cómo se cuenta cuando lo intenta el otro bando. */
  asItMightHave: string;
}

/**
 * Los episodios que dieron forma a la guerra, colocados donde ocurrieron.
 *
 * No pretende ser exhaustivo: son los que un aficionado reconoce y los que
 * explican por qué el mapa se movió como se movió.
 */
export const CHRONICLE_EVENTS: ChronicleEvent[] = [
  {
    from: ['CE', 'ML'],
    to: ['CD', 'MG', 'AM'],
    side: 'sublevados',
    asItWas:
      'El Estrecho. Con la flota amotinada del lado de la República, el Ejército de África estaba encerrado en Marruecos; lo sacaron de allí en un puente aéreo con Junkers alemanes y un convoy que cruzó de noche. Fue el movimiento que convirtió un golpe fallido en una guerra larga.',
    asItMightHave:
      'La República cruza el Estrecho en sentido contrario. Si en el 36 el Protectorado hubiera caído, el Ejército de África no habría llegado nunca a la Península y el golpe se habría quedado en un cuartelazo.',
  },
  {
    from: ['CC'],
    to: ['BD'],
    side: 'sublevados',
    asItWas:
      'Las columnas de Yagüe suben por la Vía de la Plata hacia Badajoz. Es la maniobra que unió las dos Españas sublevadas, la del sur y la del norte, y cerró la frontera portuguesa a la República.',
    asItMightHave:
      'Extremadura aguanta. Mientras Badajoz siga en pie, las dos zonas sublevadas siguen separadas y cada una pelea su propia guerra.',
  },
  {
    to: ['TO'],
    side: 'sublevados',
    asItWas:
      'Toledo y el Alcázar. La guarnición sublevada aguantó dos meses sitiada, y desviar la columna para liberarla costó semanas de avance sobre Madrid. Un símbolo comprado al precio de una capital.',
    asItMightHave:
      'La República asegura Toledo y con ella el flanco sur de Madrid. Sin ese pasillo, el avance sobre la capital tiene que buscar otro camino.',
  },
  {
    to: ['MD'],
    side: 'sublevados',
    asItWas:
      'Madrid. Noviembre del 36: las columnas entran por la Casa de Campo y la Ciudad Universitaria y se quedan clavadas calle por calle. Las Brigadas Internacionales desfilan por la Gran Vía el día 8. La ciudad no cae, y la guerra deja de ser una marcha para convertirse en un frente.',
    asItMightHave:
      'Si Madrid cae ahora, la guerra se acaba en meses. Todo lo que vino después —Jarama, Guadalajara, el Ebro— existe porque en noviembre del 36 no cayó.',
  },
  {
    from: ['SO', 'GU', 'ZG'],
    to: ['MD', 'GU'],
    side: 'sublevados',
    asItWas:
      'Guadalajara. El Corpo Truppe Volontarie italiano baja por la carretera de Francia en camiones, con niebla y barro; la contraofensiva republicana lo deshace. La mayor derrota sublevada de toda la guerra, y la última vez que se intenta rodear Madrid.',
    asItMightHave:
      'La República empuja hacia el Alto Tajo. Si consigue lo que allí no consiguió nadie, Madrid deja de estar cercada por el norte.',
  },
  {
    to: ['MG'],
    side: 'sublevados',
    asItWas:
      'Málaga, febrero del 37. Una bolsa republicana aislada entre el mar y las sierras, sin frente continuo con el resto de su zona. Cae en una semana y con ella toda la costa hasta Motril.',
    asItMightHave:
      'La República sostiene Málaga y mantiene abierta la costa andaluza, que fue lo que no pudo hacer.',
  },
  {
    from: ['NA', 'BU', 'VI'],
    to: ['BI', 'SS', 'CB', 'AS'],
    side: 'sublevados',
    asItWas:
      'La campaña del Norte. Primero Guipúzcoa para cortar la frontera francesa, luego el Cinturón de Hierro de Bilbao, Santander y por último Asturias. Al perderlo, la República pierde el hierro, el carbón y la industria pesada, y ya no vuelve a recuperarlos.',
    asItMightHave:
      'El Norte contraataca hacia Castilla. Con la cornisa cantábrica en pie, la República conserva su industria y la guerra cambia de aritmética.',
  },
  {
    from: ['MD'],
    to: ['AV', 'TO', 'SG'],
    side: 'republica',
    asItWas:
      'Brunete. La República ataca en julio para aliviar el Norte: rompe el frente unos kilómetros, se queda sin fuerzas y lo pierde casi todo en el contraataque. Aprendió a atacar antes que a explotar lo ganado.',
    asItMightHave:
      'Los sublevados presionan desde Madrid hacia la sierra. Si el cerco se cierra por ahí, la capital se queda sin espalda.',
  },
  {
    from: ['LL', 'TA', 'CS'],
    to: ['ZG', 'HU', 'TE'],
    side: 'republica',
    asItWas:
      'El frente de Aragón. Las columnas salieron de Barcelona en julio del 36 camino de Zaragoza y no llegaron nunca: se quedaron a las puertas y allí se estancó todo un año. Belchite se tomó en agosto del 37 y no sirvió de nada.',
    asItMightHave:
      'Los sublevados empujan hacia el Mediterráneo. Si Aragón se rompe hacia el este, la zona republicana queda partida en dos.',
  },
  {
    from: ['CU', 'GU', 'VL'],
    to: ['TE'],
    side: 'republica',
    asItWas:
      'Teruel, diciembre del 37, con veinte grados bajo cero. La República toma la ciudad —la única capital de provincia que conquistó en toda la guerra— y la pierde dos meses después, con ella el ejército que había reunido para tomarla.',
    asItMightHave:
      'Los sublevados aseguran Teruel y el saliente que apunta al Levante queda listo para la ofensiva que parte España en dos.',
  },
  {
    from: ['TE', 'ZG'],
    to: ['CS', 'TA'],
    side: 'sublevados',
    asItWas:
      'La ofensiva de Aragón hacia el mar. En abril del 38 las tropas llegan al Mediterráneo por Vinaroz y la zona republicana queda cortada en dos: Cataluña por un lado, el Centro y el Levante por otro.',
    asItMightHave:
      'La República aguanta el corredor del Ebro y evita quedar partida en dos, que fue el golpe del que ya no se levantó.',
  },
  {
    from: ['TA', 'LL'],
    to: ['ZG', 'TE'],
    side: 'republica',
    asItWas:
      'El Ebro. La mayor batalla de la guerra: la República cruza el río en julio del 38 con todo lo que le queda y aguanta cuatro meses de contraataques y aviación. Cuando se retira, ha gastado su último ejército.',
    asItMightHave:
      'Los sublevados cruzan el Ebro en sentido contrario, camino de Cataluña, sin tener que pagar antes cuatro meses de desgaste.',
  },
  {
    from: ['ZG', 'TE', 'HU'],
    to: ['LL', 'TA', 'BR', 'GI'],
    side: 'sublevados',
    asItWas:
      'La campaña de Cataluña, enero del 39. El frente ya no existe: se avanza más rápido de lo que la retaguardia puede seguir, y detrás va medio millón de personas camino de la frontera.',
    asItMightHave:
      'Cataluña resiste y la frontera francesa sigue abierta. Mientras el Ebro esté en manos republicanas, la guerra no está decidida.',
  },
  {
    from: ['BR', 'GI'],
    to: ['HU', 'LL'],
    side: 'republica',
    asItWas:
      'Las columnas de milicias suben del llano hacia el Pirineo aragonés. Salieron de Barcelona con más entusiasmo que fusiles y organizadas por sindicatos, no por regimientos.',
    asItMightHave:
      'El avance viene del norte hacia Cataluña, y lo que en el 36 fue una salida hacia Zaragoza se convierte en una defensa del Segre.',
  },
  {
    to: ['AT', 'MU'],
    side: 'sublevados',
    asItWas:
      'El Levante y los puertos. En marzo del 39 el frente se deshace y Alicante es el último sitio donde se espera un barco que no llega.',
    asItMightHave:
      'El Levante sigue siendo la retaguardia que alimenta la guerra: sus puertos son por donde entra lo que llega de fuera.',
  },
  {
    to: ['PM'],
    side: 'republica',
    asItWas:
      'El desembarco en Mallorca, agosto del 36. La columna catalana pone pie en la isla y aguanta tres semanas, hasta que la aviación italiana llegada desde allí obliga a reembarcar.',
    asItMightHave:
      'Baleares en manos sublevadas es una base aérea sobre la costa del Levante. Quien tenga la isla tiene el mar de por medio.',
  },
];

/** Lo que se dice cuando la pareja no tiene episodio propio. */
const GENERIC: Record<string, string[]> = {
  montaña: [
    'Se ataca monte arriba, que es como decir de uno en fondo por la carretera: el que está arriba ve venir la columna con horas de antelación.',
    'La sierra no se toma con números, se toma con paciencia. Arriba basta una compañía bien puesta.',
  ],
  bosque: [
    'El monte bajo se traga a las secciones en cuanto entran. Nadie sabe dónde está el vecino y el frente se vuelve una línea de rumores.',
    'Entre los pinos no hay línea: hay tiroteos sueltos que nadie sabe quién está ganando hasta que amanece.',
  ],
  desierto: [
    'Terreno pelado y sin un árbol donde meterse. La columna se ve desde el otro lado del valle y la aviación no tiene que buscarla.',
    'Aquí no hay dónde esconderse. Se avanza a la vista de todos y se paga en cuanto el otro tiene una batería.',
  ],
  costa: [
    'El frente llega hasta la playa, y lo que se mueve por la carretera de la costa lo ve cualquier barco.',
    'La franja litoral es estrecha: quien la corta deja al de al lado sin puerto y sin salida.',
  ],
  llanura: [
    'Campo abierto y carretera recta: aquí se avanza rápido y se muere rápido.',
    'En el llano manda quien tenga más camiones y más artillería, y no hay mucho más que contar.',
  ],
};

/** Cómo se llama a cada bando en la crónica. */
const SIDE_VOICE: Record<string, string> = {
  republica: 'las fuerzas de la República',
  sublevados: 'las tropas sublevadas',
};

export interface ChronicleContext {
  map: GameMap;
  state: GameState;
  playerId: PlayerId;
  from: TerritoryId;
  to: TerritoryId;
}

/**
 * Crónica de un ataque concreto. Devuelve null si el mapa no es un escenario.
 *
 * `rng` solo elige entre variantes equivalentes, así que el texto sigue siendo
 * una función pura de (estado, acción, semilla).
 */
export function chronicleFor(context: ChronicleContext, rng: Rng): string | null {
  const { map, state, playerId, from, to } = context;
  if (!map.scenario) return null;

  const player = state.players.find((p) => p.id === playerId);
  const side = player?.side;
  if (!side) return null;

  const fromName = map.territories.find((t) => t.id === from)?.name ?? from;
  const toName = map.territories.find((t) => t.id === to)?.name ?? to;
  const header = `${fromName} → ${toName}.`;

  const event = CHRONICLE_EVENTS.find(
    (candidate) =>
      candidate.to.includes(to) && (!candidate.from || candidate.from.includes(from)),
  );

  if (event) {
    const body = event.side === side ? event.asItWas : event.asItMightHave;
    return `${header} ${body}`;
  }

  const terrain = terrainOf(map, to);
  const options = GENERIC[terrain] ?? GENERIC['llanura'];
  const line = options[rng.int(0, options.length - 1)];
  const voice = SIDE_VOICE[side] ?? 'la columna';
  return `${header} Atacan ${voice}. ${line}`;
}

/** ¿Este mapa tiene crónica? */
export function hasChronicle(map: GameMap): boolean {
  return !!map.scenario;
}
