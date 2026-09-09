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

/** Lo que se espera al modelo antes de darlo por perdido. */
const PACIENCIA_MS = 6000;

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
    const contexto = this.contexto(state, momento);
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
    if (state.revelado || this.faltan(state).length === 0) return;

    const insistir = (): void => {
      const ahora = actor.estadoDelJuego() as ScrumState | null;
      if (!ahora || ahora.revelado || this.faltan(ahora).length === 0) {
        this.parar();
        return;
      }
      this.soltar(actor, ahora, 'espabila');
      // Un reloj pendiente no puede impedir que el proceso termine.
      this.prisa = setTimeout(insistir, CADA_CUANTO_INSISTE_MS).unref();
    };

    this.prisa = setTimeout(insistir, ANTES_DE_METER_PRISA_MS).unref();
  }

  /** Quién falta por votar, sin contar a los bots. */
  private faltan(state: ScrumState): SeatId[] {
    return this.mesa.humanos().filter((seat) => !(seat in state.votos));
  }

  private contexto(state: ScrumState, momento: MomentoDealer): ContextoDelDealer {
    const nombres = this.mesa.nombres();
    const votos = numericos(state.votos);
    const stats = estadisticaDe(votos);
    const desviado = elMasDesviado(votos, stats);

    const mesa: EnLaMesaDePoker[] = this.mesa.humanos().map((seat) => ({
      nombre: nombres[seat] ?? 'alguien',
      voto: comoSeLee(state.votos[seat]),
      haVotado: seat in state.votos,
    }));

    const protagonista = this.deQuienSeHabla(state, momento, desviado?.seatId ?? null);

    return {
      momento,
      asunto: state.asunto,
      mesa,
      protagonista: protagonista ? (nombres[protagonista] ?? 'alguien') : null,
      voto: desviado?.valor ?? 0,
      media: stats.media,
      mediana: stats.mediana,
      desviacion: stats.desviacion,
      faltan: this.faltan(state).length,
      segundos: Math.round(ANTES_DE_METER_PRISA_MS / 1000),
      guion: '',
    };
  }

  /**
   * A quién señala el comentario.
   *
   * Según el momento: al que se ha ido de madre, al que ha pedido café, al
   * primero que votó. Señalar al que no toca es peor que no señalar a nadie.
   */
  private deQuienSeHabla(
    state: ScrumState,
    momento: MomentoDealer,
    desviado: SeatId | null,
  ): SeatId | null {
    if (momento === 'elDesviado') return desviado;
    if (momento === 'cafe') return quienVoto(state, 'cafe');
    if (momento === 'porro') return quienVoto(state, 'porro');
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
        this.modelo(this.ajustes, mensajes, { maxTokens: 120 }),
        seAgota(),
      ]);
      return aceptable(respuesta.text) ? respuesta.text.trim() : null;
    } catch {
      // Sin red, sin cuota o con la clave mal: se queda el guion escrito y la
      // mesa no se entera de que ha pasado nada.
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

/** Cómo se lee un voto para contárselo al modelo. */
function comoSeLee(voto: ScrumVote | undefined): string {
  if (!voto) return '';
  if (voto.tipo === 'numero') return String(voto.valor);
  return voto.tipo === 'cafe' ? 'café (necesita un descanso)' : 'porro (esto no se puede estimar)';
}

function quienVoto(state: ScrumState, tipo: 'cafe' | 'porro'): SeatId | null {
  const encontrado = Object.entries(state.votos).find(([, voto]) => voto.tipo === tipo);
  return encontrado?.[0] ?? null;
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
 * Se comprueba lo mínimo: que diga algo y que no se enrolle. Lo único que
 * puede estropear es el tono, porque los votos no salen de aquí.
 */
function aceptable(texto: string): boolean {
  const limpio = texto.trim();
  return limpio.length > 5 && limpio.length <= LARGO_MAXIMO;
}
