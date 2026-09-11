import { describe, expect, it } from 'vitest';
import { presupuestoDe, recortar } from './medida';

describe('el presupuesto de tokens', () => {
  it('da menos tokens a los momentos cortos que a los largos', () => {
    expect(presupuestoDe(90)).toBeLessThan(presupuestoDe(420));
  });

  it('no pide tanto como para escribir el doble de lo que se acepta', () => {
    // El fallo de producción del día 10: 120 tokens dan unas 480 letras y se
    // rechazaba a partir de 320. Un token da unas cuatro letras en español, así
    // que el presupuesto nunca puede dar para mucho más que la medida.
    for (const largo of [90, 140, 240, 320, 420]) {
      expect(presupuestoDe(largo) * 4).toBeLessThan(largo * 2);
    }
  });

  it('siempre deja sitio para una frase, por corta que sea la medida', () => {
    expect(presupuestoDe(1)).toBeGreaterThanOrEqual(16);
  });
});

describe('recortar lo que dice', () => {
  it('deja pasar lo que cabe, tal cual', () => {
    expect(recortar('Ronda cinco. A ver quién se moja.', 140)).toBe(
      'Ronda cinco. A ver quién se moja.',
    );
  });

  it('quita los espacios de los lados', () => {
    expect(recortar('  Vamos allá.  ', 140)).toBe('Vamos allá.');
  });

  it('corta por la última frase entera que quepa', () => {
    const largo = 'Primera frase. Segunda frase. Tercera frase que ya no cabe.';
    expect(recortar(largo, 30)).toBe('Primera frase. Segunda frase.');
  });

  it('vale también con interrogaciones y exclamaciones', () => {
    expect(recortar('¡Toma ya! ¿Quién lo ha dicho? Y se acabó.', 12)).toBe('¡Toma ya!');
  });

  it('devuelve null cuando ni la primera frase cabe', () => {
    // Aquí es donde se cae al guion escrito. No se corta a mitad de palabra:
    // media frase del presentador suena peor que la frase de reserva entera.
    expect(recortar('Una frase larguísima que no cabe de ninguna manera.', 10)).toBeNull();
  });

  it('devuelve null si el modelo no dijo nada aprovechable', () => {
    expect(recortar('   ', 140)).toBeNull();
    expect(recortar('ok', 140)).toBeNull();
  });

  it('salva las respuestas que producción estaba tirando', () => {
    // Las cifras son las de los logs del VPS del 10 de septiembre: 495, 484 y
    // 409 letras, todas descartadas enteras. Con el recorte, de las tres sale
    // algo que se puede enseñar.
    for (const letras of [495, 484, 409]) {
      const frase = 'Vaya nivel, señores. ';
      const largo = frase.repeat(Math.ceil(letras / frase.length)).slice(0, letras);
      const salida = recortar(largo, 320);

      expect(salida).not.toBeNull();
      expect(salida?.length).toBeLessThanOrEqual(320);
      expect(salida?.endsWith('.')).toBe(true);
    }
  });

  it('se quita las comillas y los asteriscos con los que a veces envuelve', () => {
    expect(recortar('"Vamos allá."', 140)).toBe('Vamos allá.');
    expect(recortar('**Vamos allá.**', 140)).toBe('Vamos allá.');
  });
});
