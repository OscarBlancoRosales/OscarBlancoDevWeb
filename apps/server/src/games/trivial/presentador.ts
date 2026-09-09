import { chatWithFallback } from '@devweb/shared/engine/ai/ai-client';
import { frasePara, instruccionesDelPresentador } from '@devweb/shared/games/trivial/guion';
import { comentarioDe } from '@devweb/shared/games/trivial/momentos';
import { rngFor } from '@devweb/shared/engine/rng';
import type { AiSettings, ChatMessage } from '@devweb/shared/engine/ai/ai-client';
import type { Comentario } from '@devweb/shared/games/trivial/momentos';
import type { TrivialState } from '@devweb/shared/games/trivial/tipos';
import type { Narrador, RoomActor } from '../../rooms/actor';
import type { SeatId } from '@devweb/shared/games/module';

/** Más largo que esto no es una frase de presentador: es un discurso. */
const LARGO_MAXIMO = 320;

/** Lo que se espera al modelo antes de darlo por perdido. */
const PACIENCIA_MS = 6000;

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

    // Y la versión con tono, cuando llegue. Si no llega, se queda la de arriba.
    void this.florear(guionada).then((florida) => {
      if (!florida) return;
      actor.aplicarDelSistema(this.locutor(actual), {
        tipo: 'presenta',
        momento: comentario.momento,
        frase: florida,
      });
    });
  }

  private guion(comentario: Comentario, state: TrivialState): string {
    const nombres = this.nombres();
    return frasePara(
      comentario.momento,
      {
        quien: comentario.quien ? (nombres[comentario.quien] ?? 'alguien') : 'alguien',
        puntos: comentario.puntos,
        ronda: state.actual + 1,
        rondas: state.rondas.length,
      },
      rngFor(state.semilla, state.jugadas, `guion:${comentario.momento}`),
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

  private async florear(guionada: string): Promise<string | null> {
    if (!this.ajustes?.enabled) return null;

    const mensajes: ChatMessage[] = [
      { role: 'system', content: instruccionesDelPresentador() },
      { role: 'user', content: `Dilo tú, con tus palabras y sin cambiar los datos: ${guionada}` },
    ];

    try {
      const respuesta = await Promise.race([
        this.modelo(this.ajustes, mensajes, { maxTokens: 120 }),
        seAgota(),
      ]);
      return aceptable(respuesta.text) ? respuesta.text.trim() : null;
    } catch {
      // Sin red, sin cuota o con la clave mal: se queda el guion, y nadie en la
      // mesa se entera de que ha pasado nada.
      return null;
    }
  }
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
}): AiSettings | null {
  if (!config.AI_KEY) return null;
  return {
    enabled: true,
    provider: proveedor(config.AI_PROVIDER),
    apiKey: config.AI_KEY,
    model: config.AI_MODEL,
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

/**
 * Si lo que ha devuelto el modelo se puede enseñar.
 *
 * Se comprueba lo mínimo -que diga algo y que no se enrolle-, porque lo único
 * que puede estropear es el tono: los datos de la ronda no salen de aquí.
 */
function aceptable(texto: string): boolean {
  const limpio = texto.trim();
  return limpio.length > 5 && limpio.length <= LARGO_MAXIMO;
}
