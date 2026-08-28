import { chatWithFallback, loadAiSettings } from '@devweb/shared/engine/ai/ai-client';
import { frasePara, instruccionesDelPresentador } from '@devweb/shared/games/trivial/guion';
import { rngFor } from '@devweb/shared/engine/rng';
import type { AiSettings, ChatMessage } from '@devweb/shared/engine/ai/ai-client';
import type { DatosDeLaFrase, Momento } from '@devweb/shared/games/trivial/guion';

/** Más largo que esto no es una frase de presentador: es un discurso. */
const LARGO_MAXIMO = 300;

/** Lo que se espera al modelo antes de tirar de guion. */
const PACIENCIA_MS = 6000;

type LlamadaAlModelo = typeof chatWithFallback;

/**
 * El presentador del concurso.
 *
 * Dos capas: el guion, que está escrito y siempre funciona, y la IA, que lo
 * reescribe con su tono cuando quien juega tiene su clave configurada.
 *
 * El orden importa y es toda la idea: la frase del guion existe **antes** de
 * llamar a nadie, así que un modelo caído, lento o tonto no deja al concurso
 * mudo. La IA aquí no puede romper una partida porque no toca la partida.
 */
export class Presentador {
  constructor(
    private readonly ajustes: () => AiSettings = loadAiSettings,
    private readonly modelo: LlamadaAlModelo = chatWithFallback,
  ) {}

  /**
   * Lo que dice en ese momento.
   *
   * Nunca lanza y nunca devuelve vacío: en el peor de los casos, el guion.
   */
  async decir(momento: Momento, datos: DatosDeLaFrase, semilla: number): Promise<string> {
    const guionada = frasePara(momento, datos, rngFor(semilla, datos.ronda, `guion:${momento}`));

    const ajustes = this.leerAjustes();
    if (!ajustes?.enabled) return guionada;

    const florida = await this.florear(guionada, ajustes);
    return florida ?? guionada;
  }

  private leerAjustes(): AiSettings | null {
    try {
      return this.ajustes();
    } catch {
      // Un navegador en privado o con el almacenamiento capado no puede dejar
      // sin presentador al concurso.
      return null;
    }
  }

  private async florear(guionada: string, ajustes: AiSettings): Promise<string | null> {
    const mensajes: ChatMessage[] = [
      { role: 'system', content: instruccionesDelPresentador() },
      { role: 'user', content: `Dilo tú, con tus palabras y sin cambiar los datos: ${guionada}` },
    ];

    try {
      const respuesta = await Promise.race([
        this.modelo(ajustes, mensajes, { maxTokens: 120 }),
        esperaAgotada(),
      ]);
      return aceptable(respuesta.text) ? respuesta.text.trim() : null;
    } catch {
      // Sin red, sin cuota o con la clave mal: se queda el guion y nadie se
      // entera de que ha pasado nada.
      return null;
    }
  }
}

function esperaAgotada(): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error('el modelo tarda demasiado'));
    }, PACIENCIA_MS);
  });
}

/**
 * Si lo que ha devuelto el modelo se puede enseñar.
 *
 * Se comprueba lo mínimo —que diga algo y que no se enrolle—, porque lo único
 * que puede estropear es el tono: los datos de la ronda no salen de aquí, salen
 * del servidor.
 */
function aceptable(texto: string): boolean {
  const limpio = texto.trim();
  return limpio.length > 5 && limpio.length <= LARGO_MAXIMO;
}
