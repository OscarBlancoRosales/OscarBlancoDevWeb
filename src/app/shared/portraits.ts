/**
 * Catálogo de retratos e iconos.
 *
 * Viven en `public/assets` y se sirven tal cual. El identificador es lo que se
 * guarda en la sala (Firebase o local): si mañana se redibuja un PNG, quien ya
 * eligió «hierro» sigue viendo hierro.
 */

export interface Portrait {
  id: string;
  name: string;
  src: string;
  blurb?: string;
}

const RISK = 'assets/risk';
const POKER = 'assets/poker/avatars';
const LEGENDS = 'assets/poker/legends';
const HOST = 'assets/trivial/host';
const DEALER = 'assets/poker/dealer';
const CAST = 'assets/trivial/cast';
const IMPOSTOR = 'assets/impostor/cast';
const GAMES = 'assets/games';

/** Comandantes que elige quien se sienta en el RISK. */
export const RISK_COMMANDERS: Portrait[] = [
  { id: 'vanguardia', name: 'Vanguardia', src: `${RISK}/commanders/vanguardia.png`, blurb: 'Oficial de campaña, de las que no alzan la voz.' },
  { id: 'hierro', name: 'Hierro', src: `${RISK}/commanders/hierro.png`, blurb: 'Parche, cicatriz y pocas ganas de negociar.' },
  { id: 'marea', name: 'Marea', src: `${RISK}/commanders/marea.png`, blurb: 'Almiranta. El mapa para ella es el mar.' },
  { id: 'sol', name: 'Sol', src: `${RISK}/commanders/sol.png`, blurb: 'Mariscal de desierto. Sonríe, y avanza.' },
  { id: 'fantasma', name: 'Fantasma', src: `${RISK}/commanders/fantasma.png`, blurb: 'Guerrilla. Aparece donde no se le espera.' },
  { id: 'forja', name: 'Forja', src: `${RISK}/commanders/forja.png`, blurb: 'Guerra industrial. El casco aún huele a soldadura.' },
];

export const DEFAULT_COMMANDER_ID = RISK_COMMANDERS[0].id;

/** Caras de los perfiles de bot. Mismo id que `BotProfile`. */
export const RISK_BOT_PORTRAITS: Record<string, Portrait> = {
  agresivo: { id: 'agresivo', name: 'Agresivo', src: `${RISK}/bots/agresivo.png` },
  cauto: { id: 'cauto', name: 'Cauto', src: `${RISK}/bots/cauto.png` },
  oportunista: { id: 'oportunista', name: 'Oportunista', src: `${RISK}/bots/oportunista.png` },
  expansivo: { id: 'expansivo', name: 'Expansivo', src: `${RISK}/bots/expansivo.png` },
  vengativo: { id: 'vengativo', name: 'Vengativo', src: `${RISK}/bots/vengativo.png` },
};

/** Facciones del escenario España 1936. Mismo id que en el mapa. */
export const RISK_FACTION_PORTRAITS: Record<string, Portrait> = {
  'ejercito-popular': { id: 'ejercito-popular', name: 'Ejército Popular', src: `${RISK}/factions/ejercito-popular.png` },
  'cnt-fai': { id: 'cnt-fai', name: 'Columnas confederadas', src: `${RISK}/factions/cnt-fai.png` },
  'ejercito-africa': { id: 'ejercito-africa', name: 'Ejército de África', src: `${RISK}/factions/ejercito-africa.png` },
  'ejercito-norte': { id: 'ejercito-norte', name: 'Ejército del Norte', src: `${RISK}/factions/ejercito-norte.png` },
};

/** Tropas del modo avanzado. */
export const RISK_UNIT_ICONS: Record<string, string> = {
  infanteria: `${RISK}/units/infanteria.png`,
  caballeria: `${RISK}/units/caballeria.png`,
  blindado: `${RISK}/units/blindado.png`,
  naval: `${RISK}/units/naval.png`,
  aereo: `${RISK}/units/aereo.png`,
};

/** Iconos de la portada de juegos. */
export const GAME_ART = {
  risk: `${GAMES}/risk.png`,
  'hundir-la-flota': `${GAMES}/flota.png`,
  trivial: `${GAMES}/trivial.png`,
  impostor: `${GAMES}/impostor.png`,
} as const;

/**
 * Mesa VIP del Scrum Poker: caricaturas de informáticos famosos, estilo
 * terminal, jugando al poker. Van las primeras en el selector.
 */
export const POKER_LEGENDS: Portrait[] = [
  { id: 'jobs', name: 'Jobs', src: `${LEGENDS}/jobs.png`, blurb: 'Un as más. One more thing.' },
  { id: 'musk', name: 'Musk', src: `${LEGENDS}/musk.png`, blurb: 'All-in. Los chips van en cohete.' },
  { id: 'gates', name: 'Gates', src: `${LEGENDS}/gates.png`, blurb: 'Las cartas son una hoja de cálculo.' },
  { id: 'zuck', name: 'Zuck', src: `${LEGENDS}/zuck.png`, blurb: 'Cara de póker. Literalmente.' },
  { id: 'linus', name: 'Linus', src: `${LEGENDS}/linus.png`, blurb: 'Empuja chips. No mergea faroles.' },
  { id: 'bezos', name: 'Bezos', src: `${LEGENDS}/bezos.png`, blurb: 'Ríe. Y tiene cuatro ases.' },
  { id: 'hopper', name: 'Hopper', src: `${LEGENDS}/hopper.png`, blurb: 'Encuentra el bug. Y el full.' },
  { id: 'satoshi', name: 'Satoshi', src: `${LEGENDS}/satoshi.png`, blurb: 'Nadie ha visto su mano. Nadie.' },
  { id: 'turing', name: 'Turing', src: `${LEGENDS}/turing.png`, blurb: 'Cifra la mano. Nadie la descifra.' },
  { id: 'guido', name: 'Guido', src: `${LEGENDS}/guido.png`, blurb: 'Indentación perfecta. Y un as.' },
  { id: 'stallman', name: 'Stallman', src: `${LEGENDS}/stallman.png`, blurb: 'Las fichas quieren ser libres.' },
  { id: 'timbl', name: 'TimBL', src: `${LEGENDS}/timbl.png`, blurb: 'This is for everyone. All-in.' },
  { id: 'hamilton', name: 'Hamilton', src: `${LEGENDS}/hamilton.png`, blurb: 'El mazo es más alto que ella.' },
  { id: 'anon', name: 'Anonymous', src: `${LEGENDS}/anon.png`, blurb: 'We are legion. Y tenemos color.' },
  { id: 'neckbeard', name: 'Neckbeard', src: `${LEGENDS}/neckbeard.png`, blurb: 'M’lady. All-in con Cheetos.' },
  { id: 'hackerman', name: 'Hackerman', src: `${LEGENDS}/hackerman.png`, blurb: 'Hackea el mazo. En 0.2 segundos.' },
];

/**
 * Avatares del Scrum Poker.
 *
 * Primero las leyendas de la mesa; detrás, personajes de ficción con el rollo
 * de la terminal.
 */
export const DEV_AVATARS: Portrait[] = [
  ...POKER_LEGENDS,
  { id: 'ada', name: 'Ada', src: `${POKER}/ada.png`, blurb: 'Tarjetas perforadas y gafas de latón.' },
  { id: 'enigma', name: 'Enigma', src: `${POKER}/enigma.png`, blurb: 'Gafas redondas y un rotor en la solapa.' },
  { id: 'navy', name: 'Almirante', src: `${POKER}/navy.png`, blurb: 'La que compilaba en un destructor.' },
  { id: 'kernel', name: 'Kernel', src: `${POKER}/kernel.png`, blurb: 'Cuello alto y un pin de circuito.' },
  { id: 'serpent', name: 'Serpiente', src: `${POKER}/serpent.png`, blurb: 'Calma, hoodie verde, indentación estricta.' },
  { id: 'pixel', name: 'Pixel', src: `${POKER}/pixel.png`, blurb: 'El CRT se le queda pegado a las gafas.' },
  { id: 'wizard', name: 'Wizard', src: `${POKER}/wizard.png`, blurb: 'Frontend. El grid es un hechizo.' },
  { id: 'null', name: 'Null', src: `${POKER}/null.png`, blurb: 'Sudadera, visor, sin logs.' },
  { id: 'lambda', name: 'Lambda', src: `${POKER}/lambda.png`, blurb: 'Monje funcional. Todo es una función.' },
  { id: 'duck', name: 'Pato', src: `${POKER}/duck.png`, blurb: 'Rubber duck debugging, edición auriculares.' },
  { id: 'cafe', name: 'Café', src: `${POKER}/cafe.png`, blurb: 'Robot barista. El deploy espera al espresso.' },
  { id: 'floppy', name: 'Floppy', src: `${POKER}/floppy.png`, blurb: '1.44 MB de actitud.' },
  { id: 'cursor', name: 'Cursor', src: `${POKER}/cursor.png`, blurb: 'El bloque que parpadea en la terminal.' },
];

export const DEFAULT_AVATAR_ID = DEV_AVATARS[0].id;

/** Estados del presentador del Trivial, para animar por código (swap de PNG). */
export type HostPose = 'idle' | 'talk' | 'talk2' | 'think' | 'wrong' | 'yes';

export const TRIVIAL_HOST: Record<HostPose, string> = {
  idle: `${HOST}/idle.png`,
  talk: `${HOST}/talk.png`,
  talk2: `${HOST}/talk2.png`,
  think: `${HOST}/think.png`,
  wrong: `${HOST}/wrong.png`,
  yes: `${HOST}/yes.png`,
};

/**
 * Crupier del Scrum Poker: albornoz, White Russian y gafas. Swap de PNG
 * según el momento de la mesa.
 */
export type PokerDealerPose =
  | 'idle'
  | 'talk'
  | 'talk2'
  | 'think'
  | 'yes'
  | 'no'
  | 'angry'
  | 'rage'
  | 'joy'
  | 'laugh'
  | 'sarcastic'
  | 'wink'
  | 'shock'
  | 'disappointed'
  | 'deal'
  | 'sip';

export const POKER_DEALER: Record<PokerDealerPose, string> = {
  idle: `${DEALER}/idle.png`,
  talk: `${DEALER}/talk.png`,
  talk2: `${DEALER}/talk2.png`,
  think: `${DEALER}/think.png`,
  yes: `${DEALER}/yes.png`,
  no: `${DEALER}/no.png`,
  angry: `${DEALER}/angry.png`,
  rage: `${DEALER}/rage.png`,
  joy: `${DEALER}/joy.png`,
  laugh: `${DEALER}/laugh.png`,
  sarcastic: `${DEALER}/sarcastic.png`,
  wink: `${DEALER}/wink.png`,
  shock: `${DEALER}/shock.png`,
  disappointed: `${DEALER}/disappointed.png`,
  deal: `${DEALER}/deal.png`,
  sip: `${DEALER}/sip.png`,
};

/**
 * Elenco del Trivial: cada participante elige uno. `blurb` es el perfil.
 */
export const TRIVIAL_CAST: Portrait[] = [
  { id: 'stack', name: 'Stack', src: `${CAST}/stack.png`, blurb: 'El 10x. Mandíbula de mármol, PRs de cristal.' },
  { id: 'tank', name: 'Tank', src: `${CAST}/tank.png`, blurb: 'Levanta hierro. Y también npm install.' },
  { id: 'ghost', name: 'Ghost', src: `${CAST}/ghost.png`, blurb: 'Sysadmin. Vive de noche y de latas.' },
  { id: 'prof', name: 'Prof', src: `${CAST}/prof.png`, blurb: 'Cátedra, coderío y chistes de punteros.' },
  { id: 'viper', name: 'Viper', src: `${CAST}/viper.png`, blurb: 'CTO. Sonríe. Ya ha decidido tu sprint.' },
  { id: 'bolt', name: 'Bolt', src: `${CAST}/bolt.png`, blurb: 'Maratón a las 7. Cluster a las 9.' },
  { id: 'nova', name: 'Nova', src: `${CAST}/nova.png`, blurb: 'UX. Si se ve bien, es que ella pasó.' },
  { id: 'sage', name: 'Sage', src: `${CAST}/sage.png`, blurb: 'Senior. Ya vio este bug en el 98.' },
  { id: 'spark', name: 'Spark', src: `${CAST}/spark.png`, blurb: 'Becaria. Pregunta tres veces. Acerta la cuarta.' },
  { id: 'atlas', name: 'Atlas', src: `${CAST}/atlas.png`, blurb: 'Seguridad. Si entra, es que ella dejó.' },
  { id: 'drift', name: 'Drift', src: `${CAST}/drift.png`, blurb: 'Hacker andrógine. Pocas palabras, mucho root.' },
];

/**
 * Elenco del Impostor: memes clásicos. Cada jugador elige uno. `blurb` es el perfil.
 */
export const IMPOSTOR_CAST: Portrait[] = [
  { id: 'troll', name: 'Troll', src: `${IMPOSTOR}/troll.png`, blurb: 'Heh. Problem, crewmate?' },
  { id: 'doge', name: 'Doge', src: `${IMPOSTOR}/doge.png`, blurb: 'Much sus. Very impostor. Wow.' },
  { id: 'alone', name: 'Forever', src: `${IMPOSTOR}/alone.png`, blurb: 'Nadie le cree. Nadie le invita. Nadie.' },
  { id: 'fine', name: 'Fine', src: `${IMPOSTOR}/fine.png`, blurb: 'La nave arde. Él toma café. Fine.' },
  { id: 'gusta', name: 'Me Gusta', src: `${IMPOSTOR}/gusta.png`, blurb: 'Le gusta que lo acusen. Demasiado.' },
  { id: 'rage', name: 'Rage', src: `${IMPOSTOR}/rage.png`, blurb: 'Le votan. FUUUUUUUUUU.' },
  { id: 'wojak', name: 'Wojak', src: `${IMPOSTOR}/wojak.png`, blurb: 'Sabe que es el impostor. Le duele.' },
  { id: 'chad', name: 'Chad', src: `${IMPOSTOR}/chad.png`, blurb: 'Yes. Era yo. Next task.' },
  { id: 'stonks', name: 'Stonks', src: `${IMPOSTOR}/stonks.png`, blurb: 'Acusar al inocente. Stonks.' },
  { id: 'cheems', name: 'Cheems', src: `${IMPOSTOR}/cheems.png`, blurb: 'No p-puede ser el imposter. Bonk.' },
  { id: 'npc', name: 'NPC', src: `${IMPOSTOR}/npc.png`, blurb: 'Has completed a task. Has completed a task.' },
  { id: 'sir', name: 'Sir', src: `${IMPOSTOR}/sir.png`, blurb: 'I say, this meeting is rather sus.' },
  { id: 'yuno', name: 'Y U NO', src: `${IMPOSTOR}/yuno.png`, blurb: 'Y U NO vote with the group.' },
  { id: 'cereal', name: 'Cereal', src: `${IMPOSTOR}/cereal.png`, blurb: 'Se enteró en la reunión. La cuchara sigue en el aire.' },
  { id: 'okay', name: 'Okay', src: `${IMPOSTOR}/okay.png`, blurb: 'Le expulsan. Okay.' },
  { id: 'penguin', name: 'Penguin', src: `${IMPOSTOR}/penguin.png`, blurb: 'Quiso acusar. Sudó. Se quedó callado.' },
  { id: 'raptor', name: 'Raptor', src: `${IMPOSTOR}/raptor.png`, blurb: 'Si el impostor es inocente, ¿quién ventila?' },
  { id: 'datboi', name: 'Dat Boi', src: `${IMPOSTOR}/datboi.png`, blurb: 'Here come dat boi. Y se va por la vent.' },
  { id: 'bongo', name: 'Bongo', src: `${IMPOSTOR}/bongo.png`, blurb: 'No habla. Solo bongos. Muy sus.' },
  { id: 'doomer', name: 'Doomer', src: `${IMPOSTOR}/doomer.png`, blurb: 'Da igual quién gane. Enciende otro.' },
  { id: 'soyjak', name: 'Soyjak', src: `${IMPOSTOR}/soyjak.png`, blurb: 'ERA ÉL. ERA ÉL. Mirad el replay.' },
  { id: 'deal', name: 'Deal', src: `${IMPOSTOR}/deal.png`, blurb: 'Le pillan. Deal with it.' },
  { id: 'moai', name: 'Moai', src: `${IMPOSTOR}/moai.png`, blurb: 'No dice nada. El silencio es el chiste.' },
  { id: 'floppa', name: 'Floppa', src: `${IMPOSTOR}/floppa.png`, blurb: 'Big floppa. Bigger sus.' },
];

export function hostSrc(pose: HostPose = 'idle'): string {
  return TRIVIAL_HOST[pose];
}

export function dealerSrc(pose: PokerDealerPose = 'idle'): string {
  return POKER_DEALER[pose];
}

export function castById(id: string | undefined): Portrait | undefined {
  return TRIVIAL_CAST.find((item) => item.id === id);
}

export function impostorById(id: string | undefined): Portrait | undefined {
  return IMPOSTOR_CAST.find((item) => item.id === id);
}

export function commanderById(id: string | undefined): Portrait | undefined {
  return RISK_COMMANDERS.find((item) => item.id === id);
}

export function avatarById(id: string | undefined): Portrait | undefined {
  return DEV_AVATARS.find((item) => item.id === id);
}

export function factionPortraitSrc(factionId: string | undefined): string | undefined {
  return factionId ? RISK_FACTION_PORTRAITS[factionId]?.src : undefined;
}

export function botPortraitSrc(profile: string | undefined): string | undefined {
  return profile ? RISK_BOT_PORTRAITS[profile]?.src : undefined;
}

/**
 * Qué cara enseña un asiento: la que eligió, o la del bot, o nada.
 */
export function seatPortraitSrc(seat: {
  portraitId?: string;
  kind?: string;
  botProfile?: string;
}): string | undefined {
  if (seat.kind === 'bot') return botPortraitSrc(seat.botProfile) ?? commanderById(seat.portraitId)?.src;
  return commanderById(seat.portraitId)?.src;
}
