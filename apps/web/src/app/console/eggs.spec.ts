import { describe, expect, it } from 'vitest';
import { banner, cowsay, fakeTop, fortune, hackLog, TRAIN } from './eggs';

describe('la vaca', () => {
  it('dice lo que le mandas', () => {
    expect(cowsay('hola').join('\n')).toContain('hola');
  });

  it('el globo se ajusta a lo que dice', () => {
    const corto = cowsay('hi');
    const largo = cowsay('una frase considerablemente más larga');
    expect(largo[0].length).toBeGreaterThan(corto[0].length);
  });

  it('y debajo siempre está la vaca', () => {
    expect(cowsay('mu').join('\n')).toContain('^__^');
  });

  it('sin texto no se rompe', () => {
    expect(cowsay('').length).toBeGreaterThan(0);
  });
});

describe('las letras gigantes', () => {
  it('salen cinco líneas de alto', () => {
    expect(banner('OK').length).toBe(5);
  });

  it('todas las líneas miden lo mismo', () => {
    const lineas = banner('DEV');
    expect(new Set(lineas.map((l) => l.length)).size).toBe(1);
  });

  it('más letras, más ancho', () => {
    expect(banner('AB')[0].length).toBeGreaterThan(banner('A')[0].length);
  });

  it('lo que no conoce lo ignora en vez de romperse', () => {
    expect(() => banner('Añ@#')).not.toThrow();
  });

  it('sin texto devuelve algo vacío pero válido', () => {
    expect(banner('').length).toBe(5);
  });
});

describe('las frases de galleta', () => {
  it('la misma tirada da siempre la misma frase', () => {
    expect(fortune(3)).toBe(fortune(3));
  });

  it('tiradas distintas dan frases distintas', () => {
    expect(fortune(0)).not.toBe(fortune(1));
  });

  it('cualquier número vale, por grande que sea', () => {
    expect(fortune(99999).length).toBeGreaterThan(0);
  });
});

describe('el top de mentira', () => {
  it('lista procesos con su CPU', () => {
    const filas = fakeTop(() => 0.5);
    expect(filas.length).toBeGreaterThan(3);
    expect(filas.join('\n')).toMatch(/\d+([.,]\d+)?\s*%/);
  });

  it('con los mismos dados sale lo mismo', () => {
    expect(fakeTop(() => 0.5)).toEqual(fakeTop(() => 0.5));
  });
});

describe('el acceso al mainframe', () => {
  it('cuenta una historia de varios pasos', () => {
    expect(hackLog().length).toBeGreaterThan(4);
  });

  it('y acaba confesando que es broma', () => {
    expect(hackLog().join(' ').toLowerCase()).toMatch(/broma|joke/);
  });
});

describe('el tren', () => {
  it('tiene vagones dibujados', () => {
    expect(TRAIN.length).toBeGreaterThan(2);
    expect(new Set(TRAIN.map((l) => l.length)).size).toBe(1);
  });
});
