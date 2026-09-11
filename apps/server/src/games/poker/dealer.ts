import { chatWithFallback } from '@devweb/shared/engine/ai/ai-client';
import { createRng } from '@devweb/shared/engine/rng';
import { fraseDelDealer } from '@devweb/shared/games/poker-dealer';
import { encargoDelDealer, instruccionesDelDealer } from '@devweb/shared/games/poker-prompts';
import { elMasDesviado, estadisticaDe, hayDosBandos, numericos } from '@devweb/shared/games/scrum-mesa';
import type { AiSettings, ChatMessage } from '@devweb/shared/engine/ai/ai-client';
import type { ContextoDelDealer, EnLaMesaDePoker } from '@devweb/shared/games/poker-prompts';
import type { MomentoDealer } from '@devweb/shared/games/poker-reparto';
import type { ScrumState, ScrumVote } from '@devweb/shared/games/scrum';
import type { SeatId } from '@devweb/shared/games/module';
import type { Narrador, RoomActor } from '../../rooms/actor';

/** Más largo que esto no es un comentario de crupier: es un monólogo. */
const LARGO_MAXIMO = 300;

/**
 * Lo que se espera al modelo antes de darlo por perdido.
 *
 * Este plazo cubre la cadena entera, no una llamada: cuando el primero está
 * saturado o se ha retirado, el bueno es el segundo o el tercero, y con doce
 * segundos el plazo se agotaba antes de llegar a él —que es justo lo que
 * pasaba en producción—. Veinticinco dan para dos intentos largos. Mientras
 * tanto la mesa ya está leyendo la frase escrita, así que esperar no cuesta
 * nada: lo floreado sustituye al guion cuando llega.
 */
const PACIENCIA_MS = 25_000;

/** Lo que se le da a cada modelo por separado. Tres caben en la paciencia. */
const PLAZO_POR_MODELO_MS = 8_000;

/**
 * Cuánto aguanta el dealer antes de meter prisa, y cada cuánto insiste.
 *
 * Cuarenta y cinco segundos es lo que tarda una mesa normal en votar algo que
 * tiene claro. Menos sería agobiar a quien está pensando de verdad; más, y la
 * reunión ya se ha ido a otra conversación.
 */
const ANTES_DE_METER_PRISA_MS = 45_000;
const CADA_CUANTO_INSISTE_MS = 40_000;

type Llamada = typeof chatWithFallback;

/** Lo que el dealer necesita saber de la mesa y no está en el estado del juego. */
export interface LaMesa {
  nombres(): Readonly<Record<SeatId, string>>;
  /** Quiénes son personas: a un bot no se le mete prisa. */
  humanos(): readonly SeatId[];
}

/**
 * El crupier de la mesa de planning poker.
 *
 * Habla desde el servidor y su frase entra en la partida como una jugada más,
 * así que toda la mesa lee lo mismo a la vez y sigue ahí si alguien recarga.
 *
 * Tiene algo que el presentador del concurso no necesitaba: un reloj. Meter
 * prisa a quien no ha votado no es reaccionar a una jugada, es reaccionar a
 * que **no** pasa nada, y eso solo se puede ver esperando. El reloj vive aquí
 * y no en el motor, que es puro y no sabe qué hora es.
 */
export class DealerDeMesa implements Narrador {
  /**
   * El aviso pendiente, para no dejar relojes sueltos.
   *
   * Se tipa como el de Node y no como el del navegador porque esto solo corre
   * en el servidor: hace falta `unref` para que un aviso a medias no impida
   * que el proceso termine.
   */
  private prisa: NodeJS.Timeout | null = null;

  constructor(
    private readonly ajustes: AiSettings | null,
    private readonly mesa: LaMesa,
    private readonly modelo: Llamada = chatWithFallback,
    /** Dónde se apunta que el modelo ha fallado. Sin esto no hay diagnóstico. */
    private readonly avisar: (motivo: string) => void = () => undefined,
  ) {}

  trasJugada(actor: RoomActor, antes: unknown, ahora: unknown): void {
    const previo = antes as ScrumState | null;
    const actual = ahora as ScrumState | null;
    if (!previo || !actual) return;

    const momento = momentoDe(previo, actual, this.mesa.humanos());
    this.reprogramarLaPrisa(actor, actual);
    if (!momento) return;

    this.soltar(actor, actual, momento);
  }

  /** Deja de vigilar. La sala se descarga y el reloj se tiene que ir con ella. */
  parar(): void {
    if (this.prisa) clearTimeout(this.prisa);
    this.prisa = null;
  }

  private soltar(actor: RoomActor, state: ScrumState, momento: MomentoDealer): void {
    const contexto = this.contexto(state, momento, actor);
    const guionada = fraseDelDealer(momento, this.datosDeLaFrase(contexto), createRng(Date.now()));

    actor.aplicarDelSistema(this.locutor(state), {
      tipo: 'dice',
      momento,
      frase: guionada,
    });

    void this.florear({ ...contexto, guion: guionada }).then((florida) => {
      if (!florida) return;
      actor.aplicarDelSistema(this.locutor(state), { tipo: 'dice', momento, frase: florida });
    });
  }

  /**
   * Programa el aviso de «espabilad» mientras quede gente por votar.
   *
   * Se reprograma en cada jugada: cada voto que entra reinicia la cuenta, así
   * que el dealer no se pone pesado con una mesa que está votando, solo con
   * una que se ha quedado parada.
   */
  private reprogramarLaPrisa(actor: RoomActor, state: ScrumState): void {
    this.parar();
    if (state.revelado || this.faltan(state, actor).length === 0) return;

    const insistir = (): void => {
      const ahora = actor.estadoDelJuego() as ScrumState | null;
      if (!ahora || ahora.revelado || this.faltan(ahora, actor).length === 0) {
        this.parar();
        return;
      }
      this.soltar(actor, ahora, 'espabila');
      // Un reloj pendiente no puede impedir que el proceso termine.
      this.prisa = setTimeout(insistir, CADA_CUANTO_INSISTE_MS).unref();
    };

    this.prisa = setTimeout(insistir, ANTES_DE_METER_PRISA_MS).unref();
  }

  /**
   * Quién falta por votar, sin contar a los bots ni a quien ya no está.
   *
   * Un asiento se queda cuando su dueño cierra la pestaña, y el crupier se
   * pasaba la ronda metiendo prisa a gente que se había ido hace media hora.
   * Para el juego siguen contando -su voto se espera-, pero para el que habla
   * no: a un asiento vacío no se le mete prisa.
   */
  private faltan(state: ScrumState, actor?: RoomActor): SeatId[] {
    return this.mesa
      .humanos()
      .filter((seat) => !(seat in state.votos))
      .filter((seat) => sigueEnLaMesa(actor, seat));
  }

  private contexto(
    state: ScrumState,
    momento: MomentoDealer,
    actor?: RoomActor,
  ): ContextoDelDealer {
    const nombres = this.mesa.nombres();
    const votos = numericos(state.votos);
    const stats = estadisticaDe(votos);
    const desviado = elMasDesviado(votos, stats);

    const mesa: EnLaMesaDePoker[] = this.mesa.humanos().map((seat) => ({
      nombre: nombres[seat] ?? 'alguien',
      voto: comoSeLee(state.votos[seat]),
      haVotado: seat in state.votos,
      presente: sigueEnLaMesa(actor, seat),
    }));

    const protagonista = this.deQuienSeHabla(state, momento, desviado?.seatId ?? null);

    return {
      momento,
      asunto: state.asunto,
      mesa,
      // El interruptor que decide qué se le cuenta al modelo. Ver `poker-prompts`.
      revelado: state.revelado,
      protagonista: protagonista ? (nombres[protagonista] ?? 'alguien') : null,
      voto: desviado?.valor ?? 0,
      media: stats.media,
      mediana: stats.mediana,
      desviacion: stats.desviacion,
      faltan: this.faltan(state, actor).length,
      segundos: Math.round(ANTES_DE_METER_PRISA_MS / 1000),
      guion: '',
    };
  }

  /**
   * A quién señala el comentario, si es que señala a alguien.
   *
   * Solo hay nombre cuando decirlo no destapa una carta: al que se ha ido de
   * madre, que eso solo pasa con la mesa ya destapada, y al primero que votó,
   * porque haber votado ya se ve en la pantalla. Del café y del porro no se
   * dice de quién son: son votos como cualquier otro.
   */
  private deQuienSeHabla(
    state: ScrumState,
    momento: MomentoDealer,
    desviado: SeatId | null,
  ): SeatId | null {
    // El desviado solo existe con las cartas destapadas, así que ahí sí hay
    // nombre. El café y el porro pasan con la mano en juego: son votos, y
    // decir de quién es el café es destapar su carta.
    if (momento === 'elDesviado') return desviado;
    // Que alguien ya ha puesto se ve en la mesa; qué ha puesto, no. Por eso
    // este sí lleva nombre.
    if (momento === 'primerVoto') return Object.keys(state.votos).at(0) ?? null;
    return null;
  }

  private datosDeLaFrase(ctx: ContextoDelDealer): Parameters<typeof fraseDelDealer>[1] {
    return {
      quien: ctx.protagonista ?? 'alguien',
      cuantos: ctx.faltan,
      media: ctx.media,
      voto: ctx.voto,
      asunto: ctx.asunto,
    };
  }

  /**
   * A nombre de qué asiento entra la frase.
   *
   * Da igual cuál mientras exista: la acción no toca ni los votos ni la ronda,
   * y el asiento solo sirve para que el registro de eventos tenga autor.
   */
  private locutor(state: ScrumState): SeatId {
    // `.at()` y no `[0]`: el índice se tipa como si siempre hubiera alguien.
    return this.mesa.humanos().at(0) ?? Object.keys(state.votos).at(0) ?? 'mesa';
  }

  private async florear(contexto: ContextoDelDealer): Promise<string | null> {
    if (!this.ajustes?.enabled) return null;

    const mensajes: ChatMessage[] = [
      { role: 'system', content: instruccionesDelDealer() },
      { role: 'user', content: encargoDelDealer(contexto) },
    ];

    try {
      const respuesta = await Promise.race([
        // El plazo por modelo es más corto que el de la cadena a propósito: si
        // el primero se queda pensando, lo que hace falta es preguntarle al
        // siguiente, no esperarle hasta agotar la paciencia entera.
        this.modelo({ ...this.ajustes, timeoutMs: PLAZO_POR_MODELO_MS }, mensajes, {
          maxTokens: 120,
        }),
        seAgota(),
      ]);
      if (aceptable(respuesta.text)) return respuesta.text.trim();
      this.avisar(`el modelo contestó algo que no se puede enseñar (${respuesta.text.length} letras)`);
      return null;
    } catch (fallo) {
      // La mesa no se entera -se queda el guion escrito-, pero quien mantiene
      // el servidor sí: «la clave está puesta y no improvisa» es imposible de
      // diagnosticar si el motivo se traga aquí en silencio.
      this.avisar(fallo instanceof Error ? fallo.message : 'el modelo falló sin decir por qué');
      return null;
    }
  }
}

/**
 * Qué ha pasado entre estos dos estados, si es que ha pasado algo.
 *
 * El orden es el de importancia en una mesa: lo que se acaba de destapar manda
 * sobre lo que se estaba votando.
 */
export function momentoDe(
  antes: ScrumState,
  ahora: ScrumState,
  humanos: readonly SeatId[],
): MomentoDealer | null {
  if (ahora.ronda !== antes.ronda) return 'reparte';

  // Al destapar: primero lo llamativo -bandos, alguien que se fue de madre- y
  // si no, el grado de acuerdo que haya salido.
  if (ahora.revelado && !antes.revelado) {
    const votos = numericos(ahora.votos);
    const stats = estadisticaDe(votos);

    if (hayDosBandos(votos)) return 'dosBandos';
    if (elMasDesviado(votos, stats)) return 'elDesviado';

    switch (stats.acuerdo) {
      case 'total':
        return 'acuerdoTotal';
      case 'consenso':
        return 'consenso';
      case 'dispersion':
        return 'dispersion';
      case 'desacuerdo':
        return 'desacuerdo';
      default:
        return 'todosListos';
    }
  }

  const nuevos = Object.keys(ahora.votos).filter((seat) => !(seat in antes.votos));
  if (nuevos.length === 0) return null;

  // El último que ha entrado, con su voto: de eso va el comentario.
  const ultimo = Object.entries(ahora.votos).find(([seat]) => seat === nuevos.at(-1))?.[1];
  if (ultimo?.tipo === 'cafe') return 'cafe';
  if (ultimo?.tipo === 'porro') return 'porro';

  const faltan = humanos.filter((seat) => !(seat in ahora.votos));
  if (faltan.length === 0) return 'todosListos';
  if (Object.keys(antes.votos).length === 0) return 'primerVoto';
  return null;
}

/**
 * Si ese asiento tiene a alguien detrás ahora mismo.
 *
 * Sin actor a mano -o con uno que no sabe de conexiones- se da por presente:
 * equivocarse hacia «está» solo hace que el crupier meta prisa de más, y
 * equivocarse hacia «se ha ido» le haría dar por cerrada una ronda que sigue.
 */
function sigueEnLaMesa(actor: RoomActor | undefined, seat: SeatId): boolean {
  return typeof actor?.conectado === 'function' ? actor.conectado(seat) : true;
}

/** Cómo se lee un voto para contárselo al modelo. */
function comoSeLee(voto: ScrumVote | undefined): string {
  if (!voto) return '';
  if (voto.tipo === 'numero') return String(voto.valor);
  return voto.tipo === 'cafe' ? 'café (necesita un descanso)' : 'porro (esto no se puede estimar)';
}

function seAgota(): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error('el modelo tarda demasiado'));
    }, PACIENCIA_MS);
  });
}

/**
 * Si lo que ha devuelto el modelo se puede enseñar.
 *
 * Se comprueba lo mínimo: que diga algo y que no se enrolle.
 *
 * No se intenta cazar aquí una fuga de votos, y no por pereza: revisar el texto
 * buscando números sería adivinar, con falsos positivos garantizados -la media
 * es un número, y el asunto puede llevar otro-. Lo que impide la fuga es que al
 * modelo no se le cuentan los votos mientras las cartas están boca abajo. Lo
 * que no sabe, no lo puede decir.
 */
function aceptable(texto: string): boolean {
  const limpio = texto.trim();
  return limpio.length > 5 && limpio.length <= LARGO_MAXIMO;
}
