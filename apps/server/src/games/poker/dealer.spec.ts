import { describe, expect, it, vi } from 'vitest';
import { DealerDeMesa, momentoDe } from './dealer';
import type { AiSettings } from '@devweb/shared/engine/ai/ai-client';
import type { ScrumState } from '@devweb/shared/games/scrum';
import type { RoomActor } from '../../rooms/actor';

/**
 * El crupier de la mesa de planning poker.
 *
 * Lo que se comprueba aquí es que habla cuando pasa algo y se calla cuando no,
 * y sobre todo que señala a quien toca: pedirle cuentas a la persona
 * equivocada delante de todo el equipo es peor que no decir nada.
 */

const MESA = {
  nombres: () => ({ oscar: 'Óscar', bea: 'Bea', eva: 'Eva' }),
  humanos: () => ['oscar', 'bea', 'eva'],
};

function estado(parcial: Partial<ScrumState> = {}): ScrumState {
  return {
    asunto: 'migrar el login',
    revelado: false,
    votos: {},
    ronda: 1,
    dice: '',
    momento: '',
    ...parcial,
  };
}

function numero(valor: number): { tipo: 'numero'; valor: number } {
  return { tipo: 'numero', valor };
}

/** Un actor de mentira que apunta lo que le mandan decir. */
function actorFalso(estadoActual: ScrumState = estado(), idos: readonly string[] = []) {
  const dicho: { momento: string; frase: string }[] = [];
  const actor = {
    aplicarDelSistema(_seatId: string, accion: unknown) {
      const dicha = accion as { momento: string; frase: string };
      dicho.push({ momento: dicha.momento, frase: dicha.frase });
    },
    estadoDelJuego: () => estadoActual,
    conectado: (seatId: string) => !idos.includes(seatId),
  };
  return { actor: actor as unknown as RoomActor, dicho };
}

const CON_CLAVE: AiSettings = {
  enabled: true,
  provider: 'openrouter',
  apiKey: 'clave-de-mentira',
  model: 'un/modelo',
};

describe('qué comenta el dealer', () => {
  it('al empezar una ronda nueva, reparte', () => {
    const antes = estado({ ronda: 1 });
    const ahora = estado({ ronda: 2 });
    expect(momentoDe(antes, ahora, MESA.humanos())).toBe('reparte');
  });

  it('el primer voto de la mesa', () => {
    const antes = estado();
    const ahora = estado({ votos: { oscar: numero(5) } });
    expect(momentoDe(antes, ahora, MESA.humanos())).toBe('primerVoto');
  });

  it('cuando ya han votado todos', () => {
    const antes = estado({ votos: { oscar: numero(5), bea: numero(5) } });
    const ahora = estado({ votos: { oscar: numero(5), bea: numero(5), eva: numero(5) } });
    expect(momentoDe(antes, ahora, MESA.humanos())).toBe('todosListos');
  });

  /** Un voto más en mitad de la ronda no da para comentario. */
  it('y con la mesa a medias, se calla', () => {
    const antes = estado({ votos: { oscar: numero(5) } });
    const ahora = estado({ votos: { oscar: numero(5), bea: numero(8) } });
    expect(momentoDe(antes, ahora, MESA.humanos())).toBeNull();
  });

  it('el café y el porro se cantan en cuanto salen', () => {
    const antes = estado({ votos: { oscar: numero(5) } });
    expect(
      momentoDe(antes, estado({ votos: { ...antes.votos, bea: { tipo: 'cafe' } } }), MESA.humanos()),
    ).toBe('cafe');
    expect(
      momentoDe(antes, estado({ votos: { ...antes.votos, bea: { tipo: 'porro' } } }), MESA.humanos()),
    ).toBe('porro');
  });

  it('si no ha pasado nada, no dice nada', () => {
    const igual = estado({ votos: { oscar: numero(5) } });
    expect(momentoDe(igual, igual, MESA.humanos())).toBeNull();
  });
});

describe('al destapar las cartas', () => {
  function destapar(votos: ScrumState['votos']): string | null {
    return momentoDe(estado({ votos }), estado({ votos, revelado: true }), MESA.humanos());
  }

  it('todos igual: acuerdo total', () => {
    expect(destapar({ oscar: numero(5), bea: numero(5), eva: numero(5) })).toBe('acuerdoTotal');
  });

  it('cerca: consenso', () => {
    expect(destapar({ oscar: numero(5), bea: numero(5), eva: numero(6) })).toBe('consenso');
  });

  /** Lo llamativo manda sobre lo estadístico: primero se señala al que se fue. */
  it('con uno que se ha ido de madre, se le señala a él', () => {
    expect(destapar({ oscar: numero(3), bea: numero(3), eva: numero(21) })).toBe('elDesviado');
  });

  it('y con la mesa partida en dos, se dice que son dos bandos', () => {
    expect(
      destapar({
        oscar: numero(1),
        bea: numero(1),
        eva: numero(13),
        luis: numero(13),
      }),
    ).toBe('dosBandos');
  });
});

describe('el dealer hablando', () => {
  it('suelta el guion escrito aunque no haya modelo', () => {
    const { actor, dicho } = actorFalso();
    const antes = estado();
    const ahora = estado({ ronda: 2 });

    new DealerDeMesa(null, MESA).trasJugada(actor, antes, ahora);

    expect(dicho).toHaveLength(1);
    expect(dicho[0].momento).toBe('reparte');
    expect(dicho[0].frase.length).toBeGreaterThan(15);
  });

  it('y nombra la tarea que se está estimando', () => {
    const { actor, dicho } = actorFalso();
    new DealerDeMesa(null, MESA).trasJugada(actor, estado(), estado({ ronda: 2 }));
    expect(dicho[0].frase).toContain('migrar el login');
  });

  /** Señalar a quien no era es peor que no señalar a nadie. */
  it('al pedir cuentas, nombra al que se desvió y su voto', () => {
    const votos = { oscar: numero(3), bea: numero(3), eva: numero(21) };
    const { actor, dicho } = actorFalso();

    new DealerDeMesa(null, MESA).trasJugada(
      actor,
      estado({ votos }),
      estado({ votos, revelado: true }),
    );

    expect(dicho[0].momento).toBe('elDesviado');
    expect(dicho[0].frase).toContain('Eva');
    expect(dicho[0].frase).toContain('21');
  });

  it('se calla cuando no ha pasado nada', () => {
    const { actor, dicho } = actorFalso();
    const igual = estado({ votos: { oscar: numero(5) } });
    new DealerDeMesa(null, MESA).trasJugada(actor, igual, igual);
    expect(dicho).toEqual([]);
  });

  describe('con un modelo detrás', () => {
    it('dice primero el guion y luego lo reescrito', async () => {
      const { actor, dicho } = actorFalso();
      const modelo = vi.fn().mockResolvedValue({ text: 'Cartas encima de la mesa.', model: 'x' });

      new DealerDeMesa(CON_CLAVE, MESA, modelo).trasJugada(actor, estado(), estado({ ronda: 2 }));
      expect(dicho).toHaveLength(1);

      await vi.waitFor(() => {
        expect(dicho).toHaveLength(2);
      });
      expect(dicho[1].frase).toBe('Cartas encima de la mesa.');
    });

    it('si el modelo falla se queda lo escrito', async () => {
      const { actor, dicho } = actorFalso();
      const modelo = vi.fn().mockRejectedValue(new Error('sin cuota'));

      new DealerDeMesa(CON_CLAVE, MESA, modelo).trasJugada(actor, estado(), estado({ ronda: 2 }));
      await Promise.resolve();
      await Promise.resolve();

      expect(dicho).toHaveLength(1);
    });

    /** Lo que se le manda al modelo con la mano en juego. */
    function encargoEnJuego(): string {
      const { actor } = actorFalso();
      const modelo = vi.fn().mockResolvedValue({ text: 'Va.', model: 'x' });
      const votos = { oscar: numero(5) };

      new DealerDeMesa(CON_CLAVE, MESA, modelo).trasJugada(actor, estado(), estado({ votos }));

      const mensajes = modelo.mock.calls[0][1] as { role: string; content: string }[];
      return mensajes[1].content;
    }

    /**
     * El agujero por el que se escapaba la ronda.
     *
     * El crupier corre en el servidor y ve el estado entero, así que es el
     * único de la mesa capaz de contar lo que `view` esconde. Y lo hacía: se le
     * mandaban todos los votos en todos los momentos, y cantaba lo que habías
     * puesto media ronda antes de que se destapara.
     */
    it('con las cartas boca abajo, al modelo no le llega ni un voto', () => {
      const encargo = encargoEnJuego();
      expect(encargo).not.toContain('Óscar: 5');
      expect(encargo).not.toMatch(/Óscar[^\n]*\b5\b/);
      expect(encargo).toMatch(/no sabes/i);
    });

    it('pero sí quién ha puesto y quién falta, con su cuenta', () => {
      const encargo = encargoEnJuego();
      expect(encargo).toContain('Óscar');
      expect(encargo).toContain('Bea');
      expect(encargo).toMatch(/han puesto \(1 de 3\)/);
      expect(encargo).toContain('Faltan 2');
    });

    it('y el personaje sigue siendo el mismo', () => {
      const { actor } = actorFalso();
      const modelo = vi.fn().mockResolvedValue({ text: 'Va.', model: 'x' });
      new DealerDeMesa(CON_CLAVE, MESA, modelo).trasJugada(
        actor,
        estado(),
        estado({ votos: { oscar: numero(5) } }),
      );
      const mensajes = modelo.mock.calls[0][1] as { role: string; content: string }[];
      expect(mensajes[0].content).toContain('manchego');
    });

    it('al destapar sí le llega la mesa entera', () => {
      const { actor } = actorFalso();
      const modelo = vi.fn().mockResolvedValue({ text: 'Va.', model: 'x' });
      const votos = { oscar: numero(5), bea: numero(5), eva: numero(5) };

      new DealerDeMesa(CON_CLAVE, MESA, modelo).trasJugada(
        actor,
        estado({ votos }),
        estado({ votos, revelado: true }),
      );

      const encargo = (modelo.mock.calls[0][1] as { content: string }[])[1].content;
      expect(encargo).toContain('Óscar: 5');
      expect(encargo).toContain('destapadas');
    });

    /** El café es un voto como otro cualquiera: de quién es, no se dice. */
    it('del café no se dice de quién es', () => {
      const { actor } = actorFalso();
      const modelo = vi.fn().mockResolvedValue({ text: 'Va.', model: 'x' });

      new DealerDeMesa(CON_CLAVE, MESA, modelo).trasJugada(
        actor,
        estado(),
        estado({ votos: { bea: { tipo: 'cafe' } } }),
      );

      const encargo = (modelo.mock.calls[0][1] as { content: string }[])[1].content;
      expect(encargo).toMatch(/alguien acaba de pedir café/i);
      expect(encargo).not.toContain('Bea ha pedido');
    });
  });
});

describe('meter prisa a la mesa', () => {
  /**
   * A un asiento vacío no se le mete prisa.
   *
   * Quien cierra la pestaña deja el asiento puesto, y el crupier se quedaba
   * insistiéndole cada cuarenta segundos a una silla.
   */
  it('si los que faltan ya se han ido, no insiste', () => {
    vi.useFakeTimers();
    const enMarcha = estado({ votos: { oscar: numero(5) } });
    const { actor, dicho } = actorFalso(enMarcha, ['bea', 'eva']);

    new DealerDeMesa(null, MESA).trasJugada(actor, estado(), enMarcha);
    dicho.length = 0;

    vi.advanceTimersByTime(120_000);
    expect(dicho.filter((una) => una.momento === 'espabila')).toHaveLength(0);
    vi.useRealTimers();
  });

  it('con gente sin votar, programa el aviso', () => {
    vi.useFakeTimers();
    const enMarcha = estado({ votos: { oscar: numero(5) } });
    const { actor, dicho } = actorFalso(enMarcha);
    const dealer = new DealerDeMesa(null, MESA);

    dealer.trasJugada(actor, estado(), enMarcha);
    dicho.length = 0;

    vi.advanceTimersByTime(60_000);
    expect(dicho[0]?.momento).toBe('espabila');

    dealer.parar();
    vi.useRealTimers();
  });

  /** Con la ronda destapada ya no hay a quién meterle prisa. */
  it('con las cartas destapadas, no', () => {
    vi.useFakeTimers();
    const destapado = estado({ votos: { oscar: numero(5) }, revelado: true });
    const { actor, dicho } = actorFalso(destapado);
    const dealer = new DealerDeMesa(null, MESA);

    dealer.trasJugada(actor, estado({ votos: { oscar: numero(5) } }), destapado);
    dicho.length = 0;

    vi.advanceTimersByTime(120_000);
    expect(dicho).toEqual([]);

    dealer.parar();
    vi.useRealTimers();
  });

  it('y cuando ya han votado todos, tampoco', () => {
    vi.useFakeTimers();
    const votos = { oscar: numero(5), bea: numero(5), eva: numero(5) };
    const completo = estado({ votos });
    const { actor, dicho } = actorFalso(completo);
    const dealer = new DealerDeMesa(null, MESA);

    dealer.trasJugada(actor, estado({ votos: { oscar: numero(5) } }), completo);
    dicho.length = 0;

    vi.advanceTimersByTime(120_000);
    expect(dicho.some((uno) => uno.momento === 'espabila')).toBe(false);

    dealer.parar();
    vi.useRealTimers();
  });

  /** Un reloj suelto sobre una sala descargada le hablaría a nadie. */
  it('parar deja de vigilar', () => {
    vi.useFakeTimers();
    const enMarcha = estado({ votos: { oscar: numero(5) } });
    const { actor, dicho } = actorFalso(enMarcha);
    const dealer = new DealerDeMesa(null, MESA);

    dealer.trasJugada(actor, estado(), enMarcha);
    dealer.parar();
    dicho.length = 0;

    vi.advanceTimersByTime(120_000);
    expect(dicho).toEqual([]);
    vi.useRealTimers();
  });
});
