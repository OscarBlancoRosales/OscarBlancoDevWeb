import { chatWithFallback } from '@devweb/shared/engine/ai/ai-client';
import { frasePara } from '@devweb/shared/games/trivial/guion';
import { encargoPara, instruccionesDelPresentador, largoDe } from '@devweb/shared/games/trivial/prompts';
import { presupuestoDe, recortar } from '@devweb/shared/games/trivial/medida';
import { comentarioDe } from '@devweb/shared/games/trivial/momentos';
import { rngFor } from '@devweb/shared/engine/rng';
import type { AiSettings, ChatMessage } from '@devweb/shared/engine/ai/ai-client';
import type { Comentario } from '@devweb/shared/games/trivial/momentos';
import type { ContextoDelPresentador, EnLaMesa } from '@devweb/shared/games/trivial/prompts';
import type { TrivialState } from '@devweb/shared/games/trivial/tipos';
import type { Narrador, RoomActor } from '../../rooms/actor';
import type { SeatId } from '@devweb/shared/games/module';

/**
 * Lo que se espera en total antes de darlo por perdido.
 *
 * Los modelos gratuitos tienen cola. Mientras tanto la mesa ya está leyendo la
 * frase escrita, así que esperar no cuesta nada.
 */
const PACIENCIA_MS = 25_000;

/**
 * Lo que se le da a cada modelo por separado. Tres caben en la paciencia.
 *
 * Sin esto, el primero que va lento se come el presupuesto entero y la cadena
 * de reserva no llega a usarse: cinco modelos configurados y ninguno probado.
 */
const PLAZO_POR_MODELO_MS = 8_000;

type Llamada = typeof chatWithFallback;

/**
 * El presentador del concurso, hablando desde el servidor.
 *
 * Antes hablaba en el navegador de cada jugador, con la clave de cada uno: la
 * mesa oía cinco frases distintas y quien no tenía clave configurada no oía
 * nada. Un programa de televisión no funciona así, y por eso se ha mudado
 * aquí: la frase se genera **una vez** y entra en la partida como una acción
 * más, con lo que llega a los cinco a la vez y sigue ahí si alguien recarga.
 *
 * Dos capas, y el orden es toda la idea: el guion escrito existe antes de
 * llamar a nadie, así que un modelo caído, lento o sin cuota no deja mudo al
 * concurso. La IA reescribe el tono; los datos —quién, cuánto, qué ronda— los
 * pone la partida y el modelo no los toca.
 */
export class PresentadorDeSala implements Narrador {
  constructor(
    private readonly ajustes: AiSettings | null,
    private readonly nombres: () => Readonly<Record<SeatId, string>>,
    private readonly modelo: Llamada = chatWithFallback,
    /** Quiénes de la mesa no tienen a nadie detrás, para poder decirlo. */
    private readonly bots: () => ReadonlySet<SeatId> = () => new Set(),
    /** Dónde se apunta que el modelo ha fallado. Sin esto no hay diagnóstico. */
    private readonly avisar: (motivo: string) => void = () => undefined,
  ) {}

  trasJugada(actor: RoomActor, antes: unknown, ahora: unknown): void {
    const previo = antes as TrivialState | null;
    const actual = ahora as TrivialState | null;
    if (!previo || !actual) return;

    const comentario = comentarioDe(previo, actual);
    if (!comentario) return;

    // El guion primero: la frase existe pase lo que pase con la red.
    const guionada = this.guion(comentario, actual);
    actor.aplicarDelSistema(this.locutor(actual), {
      tipo: 'presenta',
      momento: comentario.momento,
      frase: guionada,
    });

    // Y la versión del modelo, cuando llegue. Si no llega, se queda la de arriba.
    const contexto = this.contexto(comentario, actual, guionada);
    void this.florear(contexto).then((florida) => {
      if (!florida) return;
      actor.aplicarDelSistema(this.locutor(actual), {
        tipo: 'presenta',
        momento: comentario.momento,
        frase: florida,
      });
    });
  }

  /**
   * La frase escrita que toca, con todo lo que el guion puede aprovechar.
   *
   * No es un plan B por si la IA falla: es el presentador. Por eso se le da la
   * mesa entera -quién va segundo, quién último, cuánta diferencia hay, si de
   * quien hablamos hay alguien detrás-, que es lo que le permite decir algo
   * que pega con lo que acaba de pasar en vez de una frase suelta.
   */
  private guion(comentario: Comentario, state: TrivialState): string {
    const nombres = this.nombres();
    const bots = this.bots();
    const tabla = [...state.orden].sort(
      (uno, otro) => (state.puntos[otro] ?? 0) - (state.puntos[uno] ?? 0),
    );
    const nombreDe = (seat: SeatId | undefined): string =>
      seat ? (nombres[seat] ?? 'alguien') : '';

    return frasePara(
      comentario.momento,
      {
        quien: comentario.quien ? (nombres[comentario.quien] ?? 'alguien') : 'alguien',
        puntos: comentario.puntos,
        ronda: state.actual + 1,
        rondas: state.rondas.length,
        // El segundo y el último solo cuando hay mesa de sobra: con dos
        // jugadores, el segundo y el último son la misma persona y nombrarla
        // dos veces en la misma frase queda fatal.
        ...(tabla.length >= 3 && {
          segundo: nombreDe(tabla[1]),
          ultimo: nombreDe(tabla.at(-1)),
          diferencia: (state.puntos[tabla[0] ?? ''] ?? 0) - (state.puntos[tabla[1] ?? ''] ?? 0),
        }),
        seccion: nombreDeLaSeccion(state) ?? '',
        esBot: comentario.quien ? bots.has(comentario.quien) : false,
      },
      // La semilla del momento, no la de la jugada: así el punto de partida es
      // el mismo durante todo el programa y la cuenta de abajo puede recorrer
      // las frases una a una sin repetir.
      rngFor(state.semilla, 0, `guion:${comentario.momento}`),
      state.dichos[comentario.momento] ?? 0,
    );
  }

  /**
   * A nombre de qué asiento entra la frase.
   *
   * Da igual cuál mientras exista: la acción no cambia el marcador ni la ronda,
   * y el asiento solo sirve para que el registro de eventos tenga autor.
   */
  private locutor(state: TrivialState): SeatId {
    return state.orden[0] ?? 'sala';
  }

  /**
   * Todo lo que el presentador necesita saber para hablar de esto.
   *
   * El marcador va entero y ordenado, no solo el protagonista: sin la mesa
   * delante, un «repasamos la clasificación» se lo tiene que inventar, y ahí
   * es donde un presentador se cae.
   */
  private contexto(
    comentario: Comentario,
    state: TrivialState,
    guionada: string,
  ): ContextoDelPresentador {
    const nombres = this.nombres();
    const bots = this.bots();
    const jugadores: EnLaMesa[] = state.orden
      .map((seat) => ({
        nombre: nombres[seat] ?? 'alguien',
        puntos: state.puntos[seat] ?? 0,
        esBot: bots.has(seat),
      }))
      .sort((uno, otro) => otro.puntos - uno.puntos);

    return {
      momento: comentario.momento,
      jugadores,
      protagonista: comentario.quien ? (nombres[comentario.quien] ?? 'alguien') : null,
      cifra: comentario.puntos,
      ronda: state.actual + 1,
      rondas: state.rondas.length,
      seccion: nombreDeLaSeccion(state),
      guion: guionada,
    };
  }

  private async florear(contexto: ContextoDelPresentador): Promise<string | null> {
    if (!this.ajustes?.enabled) return null;

    const largo = largoDe(contexto.momento);
    const mensajes: ChatMessage[] = [
      { role: 'system', content: instruccionesDelPresentador() },
      { role: 'user', content: encargoPara(contexto) },
    ];

    try {
      const respuesta = await Promise.race([
        this.modelo({ ...this.ajustes, timeoutMs: PLAZO_POR_MODELO_MS }, mensajes, {
          maxTokens: presupuestoDe(largo),
        }),
        seAgota(),
      ]);

      // Recortar y no tirar. Una frase de más no puede dejar mudo al
      // presentador, y era exactamente lo que pasaba: diez de diez respuestas
      // descartadas enteras por pasarse de largo.
      const enseñable = recortar(respuesta.text, largo);
      if (enseñable) return enseñable;

      this.avisar(`el modelo no dijo ni una frase entera que quepa en ${largo} letras`);
      return null;
    } catch (fallo) {
      // La mesa no se entera, pero quien mantiene el servidor sí.
      this.avisar(fallo instanceof Error ? fallo.message : 'el modelo falló sin decir por qué');
      return null;
    }
  }
}

/** Cómo se llama en pantalla la prueba en marcha, para poder nombrarla. */
const NOMBRES_DE_SECCION: Readonly<Record<string, string>> = {
  test: 'Test',
  estimacion: 'A ojo',
  fallo: 'Encuentra el fallo',
  pulsa: 'El primero que pulse',
  rafaga: 'Ráfaga',
  bomba: 'La bomba',
};

function nombreDeLaSeccion(state: TrivialState): string | null {
  const tipo = state.rondas.at(state.actual)?.pregunta.tipo;
  return tipo ? (NOMBRES_DE_SECCION[tipo] ?? null) : null;
}

/**
 * Cómo hablar con el modelo, según lo que haya en el entorno.
 *
 * Sin clave devuelve `null`, y eso no es un error: el concurso funciona con el
 * guion escrito. Que el servidor arranque igual con IA y sin ella es lo que
 * permite levantarlo en local sin gastar un céntimo.
 */
export function ajustesDeIa(config: {
  AI_KEY: string;
  AI_PROVIDER: string;
  AI_MODEL: string;
  AI_FREE_ONLY?: boolean;
  AI_PRESENTADOR?: boolean;
}): AiSettings | null {
  if (!config.AI_KEY) return null;
  return {
    // `enabled` es solo la voz del presentador, y viene apagada: la cuota se
    // gasta en inventar preguntas, no en frases de relleno. Quien lea esto
    // buscando por qué el presentador no improvisa, es por aquí.
    enabled: config.AI_PRESENTADOR === true,
    provider: proveedor(config.AI_PROVIDER),
    apiKey: config.AI_KEY,
    model: config.AI_MODEL,
    // Sin esto, un modelo de pago puesto a mano se descartaba en silencio.
    freeOnly: config.AI_FREE_ONLY !== false,
  };
}

function proveedor(nombre: string): AiSettings['provider'] {
  const conocidos = ['openrouter', 'groq', 'gemini', 'openai-compatible'] as const;
  const encontrado = conocidos.find((uno) => uno === nombre);
  return encontrado ?? 'openrouter';
}

/** Los nombres que se leen de cada asiento, para no soltar identificadores. */
export function nombresDe(
  seats: readonly { seatId: string; displayName: string }[],
): Record<SeatId, string> {
  return Object.fromEntries(seats.map((seat) => [seat.seatId, seat.displayName]));
}

function seAgota(): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error('el modelo tarda demasiado'));
    }, PACIENCIA_MS);
  });
}

