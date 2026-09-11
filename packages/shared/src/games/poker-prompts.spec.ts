import { describe, expect, it } from 'vitest';
import { encargoDelDealer, instruccionesDelDealer } from './poker-prompts';
import type { ContextoDelDealer, EnLaMesaDePoker } from './poker-prompts';
import type { MomentoDealer } from './poker-reparto';

/**
 * Lo que se le cuenta al crupier.
 *
 * Aquí se prueba una cosa por encima de todas: que **antes de destapar, el
 * encargo no lleva ni un voto dentro**. El crupier corre en el servidor y ve el
 * estado entero, así que es el único sitio de la mesa por donde se puede
 * escapar lo que `view` se molesta en esconder. Y lo que no se le cuenta, no lo
 * puede decir.
 */

const MESA: readonly EnLaMesaDePoker[] = [
  { nombre: 'Bea', voto: '13', haVotado: true, presente: true },
  { nombre: 'Nacho', voto: '21', haVotado: true, presente: true },
  { nombre: 'Rosa', voto: 'café (necesita un descanso)', haVotado: true, presente: true },
  { nombre: 'Eva', voto: '', haVotado: false, presente: true },
  { nombre: 'Óscar', voto: '', haVotado: false, presente: true },
];

function contexto(cambios: Partial<ContextoDelDealer> = {}): ContextoDelDealer {
  return {
    momento: 'faltaGente',
    asunto: 'migrar el login',
    mesa: MESA,
    revelado: false,
    protagonista: null,
    voto: 0,
    media: 0,
    mediana: 0,
    desviacion: 0,
    faltan: 2,
    segundos: 45,
    guion: '',
    ...cambios,
  };
}

/** Los momentos que pasan con las cartas todavía boca abajo. */
const EN_JUEGO: readonly MomentoDealer[] = [
  'reparte',
  'primerVoto',
  'faltaGente',
  'espabila',
  'todosListos',
  'cafe',
  'porro',
  'nuevaRonda',
];

/** Y los que solo pasan al destapar. */
const AL_DESTAPAR: readonly MomentoDealer[] = [
  'acuerdoTotal',
  'consenso',
  'dispersion',
  'desacuerdo',
  'elDesviado',
  'dosBandos',
];

describe('con las cartas boca abajo', () => {
  it.each(EN_JUEGO)('el encargo de «%s» no lleva ningún voto dentro', (momento) => {
    const texto = encargoDelDealer(contexto({ momento }));

    // Ni los números que ha puesto la gente...
    expect(texto).not.toContain('13');
    expect(texto).not.toContain('21');
    // ...ni el nombre de nadie pegado a lo que ha votado.
    expect(texto).not.toContain('Bea: ');
    expect(texto).not.toContain('Nacho: ');
    expect(texto).not.toContain('necesita un descanso');
  });

  it('dice quién ha puesto y quién no, que es lo que sí puede contar', () => {
    const texto = encargoDelDealer(contexto());

    expect(texto).toContain('Bea');
    expect(texto).toContain('Eva');
    expect(texto).toMatch(/han puesto/i);
    expect(texto).toMatch(/faltan/i);
  });

  /** La cuenta de los dos grupos tiene que cuadrar, o el crupier se lía. */
  it('y los cuenta, para que no se equivoque al decirlo', () => {
    const texto = encargoDelDealer(contexto());
    expect(texto).toContain('3 de 5');
    expect(texto).toContain('Faltan 2');
  });

  it('le dice a las claras que no sabe lo que ha votado nadie', () => {
    expect(encargoDelDealer(contexto())).toMatch(/no sabes/i);
  });

  /**
   * Lo que el usuario sí quiere: la broma de los cafés. Es agregado y no
   * señala a nadie.
   */
  it('puede contar cuántos cafés hay, pero nunca de quién', () => {
    const conCafes = encargoDelDealer(
      contexto({
        mesa: [
          { nombre: 'Bea', voto: 'café (necesita un descanso)', haVotado: true, presente: true },
          { nombre: 'Nacho', voto: 'café (necesita un descanso)', haVotado: true, presente: true },
          { nombre: 'Rosa', voto: '5', haVotado: true, presente: true },
          { nombre: 'Eva', voto: '', haVotado: false, presente: true },
        ],
      }),
    );

    expect(conCafes).toMatch(/2 cafés/);
    expect(conCafes).not.toContain('Bea: ');
  });

  /**
   * Con un solo café entre pocos votos, decir que hay uno señala a quien lo
   * pidió: si solo ha puesto una persona, el café es suyo y no hay más vueltas.
   */
  it('se calla el recuento cuando delataría a quien lo pidió', () => {
    const texto = encargoDelDealer(
      contexto({
        mesa: [
          { nombre: 'Bea', voto: 'café (necesita un descanso)', haVotado: true, presente: true },
          { nombre: 'Eva', voto: '', haVotado: false, presente: true },
          { nombre: 'Rosa', voto: '', haVotado: false, presente: true },
        ],
        faltan: 2,
      }),
    );
    expect(texto).not.toMatch(/café/i);
  });

  it('el café y el porro se comentan sin nombre', () => {
    const texto = encargoDelDealer(contexto({ momento: 'cafe', protagonista: 'Rosa' }));
    expect(texto).toMatch(/alguien/i);
    expect(texto).not.toContain('Rosa ha pedido');
  });

  /**
   * Un asiento se queda cuando su dueño cierra la pestaña.
   *
   * Sin distinguirlos, el crupier se pasaba la ronda diciendo que faltaban tres
   * cuando en la sala había uno, y metiéndole prisa a gente que se fue hace
   * media hora. De ahí venía media sensación de que no se entera de nada.
   */
  it('a quien se ha ido no se le cuenta entre los que faltan', () => {
    const texto = encargoDelDealer(
      contexto({
        mesa: [
          { nombre: 'Bea', voto: '13', haVotado: true, presente: true },
          { nombre: 'Eva', voto: '', haVotado: false, presente: true },
          { nombre: 'Óscar', voto: '', haVotado: false, presente: false },
        ],
      }),
    );

    expect(texto).toContain('han puesto (1 de 2)');
    expect(texto).toContain('Faltan 1 por poner: Eva');
    expect(texto).toContain('Ya no están en la mesa: Óscar');
    expect(texto).toMatch(/no les metas prisa/i);
  });

  /** Decir quién ha puesto no es decir qué ha puesto: eso ya se ve en la mesa. */
  it('el primero en votar sí se dice por su nombre', () => {
    const texto = encargoDelDealer(contexto({ momento: 'primerVoto', protagonista: 'Bea' }));
    expect(texto).toContain('Bea');
  });
});

describe('con las cartas destapadas', () => {
  function destapada(momento: MomentoDealer): string {
    return encargoDelDealer(
      contexto({ momento, revelado: true, media: 6.5, mediana: 6.5, desviacion: 1.5, faltan: 0 }),
    );
  }

  it.each(AL_DESTAPAR)('el encargo de «%s» ya lleva la mesa entera', (momento) => {
    const texto = destapada(momento);
    expect(texto).toContain('Bea');
    expect(texto).toContain('13');
    expect(texto).toContain('21');
  });

  it('y las cuentas de la ronda', () => {
    expect(destapada('consenso')).toContain('Media 6.5');
  });

  it('a quien no votó se le nota que no votó', () => {
    expect(destapada('consenso')).toMatch(/no votó/i);
  });
});

describe('las instrucciones del personaje', () => {
  it('le prohíben inventarse votos', () => {
    expect(instruccionesDelDealer()).toMatch(/nunca inventas/i);
  });

  /** La regla que impide la fuga, dicha también en el personaje. */
  it('y decir lo que hay debajo de una carta boca abajo', () => {
    expect(instruccionesDelDealer()).toMatch(/boca abajo/i);
  });
});
