import { describe, expect, it } from 'vitest';
import { MOMENTOS } from './guion';
import { encargoPara, instruccionesDelPresentador } from './prompts';
import type { ContextoDelPresentador } from './prompts';
import type { Momento } from './guion';

/**
 * Lo que se le pide al modelo en cada momento del programa.
 *
 * Había un solo encargo para los veinte momentos -«reescribe esta frase»-, y
 * salían todos iguales: la entradilla, una explosión de la bomba y el cierre
 * tenían la misma forma porque se estaba pidiendo lo mismo.
 */

const MESA: ContextoDelPresentador['jugadores'] = [
  { nombre: 'Óscar', puntos: 420, esBot: false },
  { nombre: 'Bea', puntos: 260, esBot: false },
  { nombre: 'Sabelotodo', puntos: 90, esBot: true },
];

/** La tarea del encargo, que es lo primero antes de los datos. */
function primeraLinea(encargo: string): string {
  return encargo.split(String.fromCharCode(10, 10))[0];
}

function contexto(parcial: Partial<ContextoDelPresentador> = {}): ContextoDelPresentador {
  return {
    momento: 'bienvenida',
    jugadores: MESA,
    protagonista: 'Óscar',
    cifra: 420,
    ronda: 5,
    rondas: 20,
    seccion: 'La bomba',
    guion: 'Una frase de reserva que ya vale por sí sola.',
    ...parcial,
  };
}

describe('el personaje del presentador', () => {
  it('lleva la manía con Óscar, que es media gracia', () => {
    expect(instruccionesDelPresentador()).toContain('Óscar');
  });

  /** Un presentador que se inventa el marcador estropea el concurso. */
  it('tiene prohibido inventarse datos', () => {
    expect(instruccionesDelPresentador()).toContain('No inventas');
  });

  it('y hablar en emojis o con acotaciones de teatro', () => {
    const prompt = instruccionesDelPresentador();
    expect(prompt).toContain('emojis');
    expect(prompt).toContain('acotaciones');
  });
});

describe('el encargo de cada momento', () => {
  it('todos los momentos tienen el suyo, y ninguno sale vacío', () => {
    for (const momento of MOMENTOS) {
      const encargo = encargoPara(contexto({ momento }));
      expect(encargo.length, momento).toBeGreaterThan(80);
    }
  });

  /**
   * Si dos momentos pidieran lo mismo, sobraría uno de los dos.
   *
   * Las seis cortinillas son la excepción y es a propósito: la tarea es la
   * misma -«anuncia esta sección y canta sus normas»- y lo que cambia es qué
   * sección. Eso se comprueba en el test de abajo.
   */
  it('y no se repiten entre sí', () => {
    const sueltos = MOMENTOS.filter((momento) => !momento.startsWith('seccion'));
    const tareas = sueltos.map((momento) => primeraLinea(encargoPara(contexto({ momento }))));
    expect(new Set(tareas).size).toBe(sueltos.length);
  });

  it('cada cortinilla nombra su sección', () => {
    const encargo = encargoPara(contexto({ momento: 'seccionRafaga', seccion: 'Ráfaga' }));
    expect(encargo).toContain('Ráfaga');
    expect(encargo).not.toContain('La bomba');
  });

  it('el marcador entero va dentro, no solo el protagonista', () => {
    const encargo = encargoPara(contexto({ momento: 'lider' }));
    for (const uno of MESA) {
      expect(encargo, uno.nombre).toContain(uno.nombre);
      expect(encargo).toContain(String(uno.puntos));
    }
  });

  it('y se dice quién es un bot, para que pueda meterse con él', () => {
    expect(encargoPara(contexto())).toContain('es un bot');
  });

  it('las cifras se dan hechas y se prohíbe cambiarlas', () => {
    const encargo = encargoPara(contexto());
    expect(encargo).toContain('DATOS REALES');
    expect(encargo).toContain('no inventes otros');
  });
});

describe('cada momento pide lo suyo', () => {
  /** La entradilla presenta a la gente; si no, no es una entradilla. */
  it('la bienvenida manda presentar a los jugadores por su nombre', () => {
    const encargo = encargoPara(contexto({ momento: 'bienvenida' }));
    expect(encargo).toContain('presenta');
    expect(encargo).toContain('uno por uno');
  });

  it('la despedida manda resumir cómo ha ido y nombrar al ganador', () => {
    const encargo = encargoPara(contexto({ momento: 'despedida', protagonista: 'Bea' }));
    expect(encargo).toContain('resumen');
    expect(encargo).toContain('Bea');
    expect(encargo).toContain('ganado');
  });

  it('una cortinilla de sección manda explicar cómo se juega', () => {
    const encargo = encargoPara(contexto({ momento: 'seccionBomba' }));
    expect(encargo).toContain('La bomba');
    expect(encargo).toContain('cómo se juega');
  });

  it('el repaso de mitad de programa manda resumir la clasificación', () => {
    expect(encargoPara(contexto({ momento: 'lider' }))).toContain('clasificación');
  });

  it('la explosión de la bomba se pide bien fuerte', () => {
    const encargo = encargoPara(contexto({ momento: 'explota', protagonista: 'Bea', cifra: 40 }));
    expect(encargo).toContain('Bea');
    expect(encargo).toContain('40');
  });

  it('y la racha, con su número de aciertos', () => {
    expect(encargoPara(contexto({ momento: 'rachaBuena', cifra: 4 }))).toContain('4');
  });
});

describe('cuánto puede hablar', () => {
  /** Alargarse en mitad de una ronda es cortar el ritmo del juego. */
  it('en mitad del juego, corto', () => {
    expect(encargoPara(contexto({ momento: 'aciertaAlguien' }))).toContain('una o dos frases');
  });

  it('en la entradilla y el cierre, algo más', () => {
    for (const momento of ['bienvenida', 'despedida'] as Momento[]) {
      expect(encargoPara(contexto({ momento })), momento).toContain('dos y cuatro frases');
    }
  });

  it('y siempre se le pide solo lo que se dice en voz alta', () => {
    for (const momento of MOMENTOS) {
      expect(encargoPara(contexto({ momento })), momento).toContain('solo lo que se dice');
    }
  });
});

describe('una mesa vacía', () => {
  /** En la bienvenida puede no haber marcador todavía. */
  it('no rompe el encargo', () => {
    const encargo = encargoPara(contexto({ jugadores: [], protagonista: null }));
    expect(encargo).toContain('Todavía no hay marcador');
  });
});
