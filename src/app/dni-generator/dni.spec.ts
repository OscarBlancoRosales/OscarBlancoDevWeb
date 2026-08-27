import { describe, expect, it } from 'vitest';
import { controlLetter, isValidDocument, makeDocument } from './dni';

/**
 * La letra no es un adorno: sale del número por módulo 23 contra una tabla
 * fija. Si se calcula mal, el documento parece válido y no lo es, que es
 * justo lo que esta herramienta tiene que evitar.
 */
describe('la letra de control', () => {
  it('el ejemplo que sale en todas partes', () => {
    expect(controlLetter('12345678')).toBe('Z');
  });

  it('el cero también tiene la suya', () => {
    expect(controlLetter('00000000')).toBe('T');
  });

  it('en un NIE, la X cuenta como cero', () => {
    expect(controlLetter('X1234567')).toBe('L');
  });

  it('la Y como uno', () => {
    expect(controlLetter('Y1234567')).toBe('X');
  });

  it('y la Z como dos', () => {
    expect(controlLetter('Z1234567')).toBe('R');
  });
});

describe('generar documentos', () => {
  it('un DNI son ocho dígitos y una letra', () => {
    expect(makeDocument('dni')).toMatch(/^\d{8}[A-Z]$/);
  });

  it('un NIE empieza por X, Y o Z', () => {
    expect(makeDocument('nie')).toMatch(/^[XYZ]\d{7}[A-Z]$/);
  });

  it('lo que sale siempre es válido, cien veces seguidas', () => {
    for (let i = 0; i < 100; i++) {
      expect(isValidDocument(makeDocument('dni')), 'dni').toBe(true);
      expect(isValidDocument(makeDocument('nie')), 'nie').toBe(true);
    }
  });

  it('dos seguidos no salen iguales', () => {
    const unos = new Set(Array.from({ length: 20 }, () => makeDocument('dni')));
    expect(unos.size).toBeGreaterThan(1);
  });
});

describe('validar documentos', () => {
  it('acepta uno bueno', () => {
    expect(isValidDocument('12345678Z')).toBe(true);
  });

  it('rechaza uno con la letra cambiada', () => {
    expect(isValidDocument('12345678A')).toBe(false);
  });

  it('da igual cómo lo escribas de mayúsculas o con espacios', () => {
    expect(isValidDocument(' 12345678z ')).toBe(true);
  });

  it('rechaza lo que no tiene forma de documento', () => {
    for (const malo of ['', '1234', 'ABCDEFGHI', '123456789', 'W1234567L']) {
      expect(isValidDocument(malo), malo).toBe(false);
    }
  });
});
