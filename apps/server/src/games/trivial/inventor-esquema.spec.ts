import { describe, expect, it } from 'vitest';
import { createRng } from '@devweb/shared/engine/rng';
import { aPregunta } from './inventor-esquema';

/**
 * Recoger lo que escribe un modelo sin fiarse de ello.
 *
 * La forma se puede garantizar; la verdad no. Esto hace lo primero y da por
 * hecho lo segundo: unas cuantas por programa saldrán mal contestadas, y para
 * eso está el botón de impugnar.
 */
const RNG = (): ReturnType<typeof createRng> => createRng(7);

const BUENA = {
  enunciado: '¿Qué puerto usa HTTPS por defecto?',
  opciones: ['80', '443', '8080', '22'],
  respuesta: '443',
  explicacion: 'El 443. El 22 es SSH y el 8080 es donde acaba todo lo que levantas en local.',
  dificultad: 2,
};

describe('recoger una pregunta inventada', () => {
  it('convierte la respuesta escrita en el índice que le toca', () => {
    // Se le pide escrita y no numerada porque los modelos cuentan fatal: dicen
    // «la 2» queriendo decir la tercera, o cuentan desde uno.
    const pregunta = aPregunta('test', BUENA, 'ia-1', RNG());

    expect(pregunta).not.toBeNull();
    expect(pregunta?.opciones[pregunta.correcta]).toBe('443');
  });

  it('baraja las opciones', () => {
    // Un modelo pone la buena la primera mucho más de lo que el azar permite.
    // Contar sin leer no puede ser una estrategia ganadora.
    const ordenes = new Set<string>();
    for (let semilla = 0; semilla < 20; semilla += 1) {
      const pregunta = aPregunta('test', BUENA, 'ia-1', createRng(semilla));
      if (pregunta) ordenes.add(pregunta.opciones.join('|'));
    }

    expect(ordenes.size).toBeGreaterThan(1);
  });

  it('tira la pregunta si la respuesta no está entre las opciones', () => {
    expect(aPregunta('test', { ...BUENA, respuesta: '8443' }, 'ia-1', RNG())).toBeNull();
  });

  it('perdona la letra y las comillas con las que a veces la envuelve', () => {
    expect(aPregunta('test', { ...BUENA, respuesta: 'B) 443' }, 'ia-1', RNG())).not.toBeNull();
    expect(aPregunta('test', { ...BUENA, respuesta: '"443"' }, 'ia-1', RNG())).not.toBeNull();
    expect(aPregunta('test', { ...BUENA, respuesta: ' 443 ' }, 'ia-1', RNG())).not.toBeNull();
  });

  it('tira la que tiene dos opciones iguales', () => {
    // Con dos iguales, «cuál es la buena» deja de tener respuesta.
    const repetida = { ...BUENA, opciones: ['443', '443', '80', '22'] };
    expect(aPregunta('test', repetida, 'ia-1', RNG())).toBeNull();
  });

  it('exige cuatro opciones en las pruebas que son de cuatro', () => {
    expect(aPregunta('test', { ...BUENA, opciones: ['443', '80'] }, 'ia-1', RNG())).toBeNull();
  });

  it('en la ráfaga impone verdadero o falso', () => {
    const vof = {
      ...BUENA,
      opciones: [],
      respuesta: 'Verdadero',
      enunciado: 'PUT es idempotente y POST no.',
    };
    const pregunta = aPregunta('rafaga', vof, 'ia-1', RNG());

    expect(pregunta?.opciones).toEqual(['Verdadero', 'Falso']);
    expect(pregunta?.correcta).toBe(0);
  });

  it('y en la ráfaga no baraja: verdadero va siempre primero', () => {
    // Que el sitio del «verdadero» cambie entre preguntas de una prueba que se
    // contesta en diez segundos es una crueldad, no una dificultad.
    for (let semilla = 0; semilla < 10; semilla += 1) {
      const pregunta = aPregunta(
        'rafaga',
        { ...BUENA, opciones: [], respuesta: 'Falso' },
        'x',
        createRng(semilla),
      );

      expect(pregunta?.opciones[0]).toBe('Verdadero');
      expect(pregunta?.correcta).toBe(1);
    }
  });

  it('en la estimación la respuesta es un número y hace falta el margen', () => {
    const conMargen = {
      enunciado: '¿En qué año salió la primera versión de Git?',
      opciones: [],
      respuesta: '2005',
      margen: 6,
      explicacion: 'Lo escribió Linus en abril de 2005, en un par de semanas.',
      dificultad: 3,
    };

    expect(aPregunta('estimacion', conMargen, 'ia-1', RNG())?.correcta).toBe(2005);
    expect(aPregunta('estimacion', { ...conMargen, margen: undefined }, 'ia-1', RNG())).toBeNull();
    expect(aPregunta('estimacion', { ...conMargen, respuesta: 'muchos' }, 'ia-1', RNG())).toBeNull();
  });

  it('tira lo que no encaja en el esquema', () => {
    expect(aPregunta('test', null, 'ia-1', RNG())).toBeNull();
    expect(aPregunta('test', { enunciado: 'corta' }, 'ia-1', RNG())).toBeNull();
    expect(aPregunta('test', { ...BUENA, dificultad: 11 }, 'ia-1', RNG())).toBeNull();
    expect(aPregunta('test', { ...BUENA, explicacion: '' }, 'ia-1', RNG())).toBeNull();
  });

  it('y lo que trae campos de más, que es como se cuela la basura', () => {
    expect(aPregunta('test', { ...BUENA, respuestaCorrecta: 1 }, 'ia-1', RNG())).toBeNull();
  });

  it('conserva la dificultad, el tipo y el identificador que se le dan', () => {
    const pregunta = aPregunta('pulsa', BUENA, 'ia-7', RNG());

    expect(pregunta?.tipo).toBe('pulsa');
    expect(pregunta?.dificultad).toBe(2);
    expect(pregunta?.id).toBe('ia-7');
  });

  it('y el código, cuando lo trae', () => {
    const conCodigo = { ...BUENA, codigo: 'const a = 1;\nconsole.log(b);' };
    expect(aPregunta('fallo', conCodigo, 'ia-2', RNG())?.codigo).toContain('console.log');
  });
});
