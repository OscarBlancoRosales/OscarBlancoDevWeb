import type { Narrador, RoomActor } from './actor';

/**
 * Varios narradores por el único hueco que tiene la sala.
 *
 * El concurso necesita dos cosas a la vez que no son la misma: alguien que
 * hable -el presentador, que puede llamar a un modelo y tardar- y alguien que
 * lleve el reloj -el regidor, que no habla con nadie-. Meterlas en una clase
 * las ataría: no se podría probar el cronómetro sin un modelo de mentira, ni
 * apagar la IA sin quedarse sin cronómetro.
 *
 * Si uno se cae, los demás siguen. Que el presentador reviente hablando con un
 * modelo no puede dejar a la sala sin reloj.
 */
export function coro(...narradores: readonly (Narrador | null)[]): Narrador {
  const vivos = narradores.filter((uno): uno is Narrador => uno !== null);

  return {
    trasJugada(actor: RoomActor, antes: unknown, ahora: unknown): void {
      for (const uno of vivos) {
        try {
          uno.trasJugada(actor, antes, ahora);
        } catch {
          // Ninguno puede llevarse por delante a los que van detrás.
        }
      }
    },

    parar(): void {
      for (const uno of vivos) {
        try {
          uno.parar?.();
        } catch {
          // Al descargar la sala ya da igual el motivo: lo que importa es
          // soltarlos a todos, incluido el que va después del que falla.
        }
      }
    },
  };
}
