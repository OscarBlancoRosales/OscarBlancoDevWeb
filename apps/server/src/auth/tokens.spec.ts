import { describe, expect, it } from 'vitest';
import {
  generateToken,
  hashToken,
  isAccessToken,
  signPayload,
  tokensMatch,
  verifyPayload,
} from './tokens';

const SECRET = 'secreto-de-pruebas-suficientemente-largo';

describe('tokens de sesión', () => {
  it('no repite un token', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateToken()));
    expect(tokens.size).toBe(500);
  });

  it('el hash no deja recuperar el token', () => {
    const token = generateToken();
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toHaveLength(64);
  });

  it('el mismo token da siempre el mismo hash, que es lo que permite buscarlo', () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('compara sin fiarse de la longitud', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abc', 'abcd')).toBe(false);
    expect(tokensMatch('abc', 'abd')).toBe(false);
  });
});

describe('token de acceso', () => {
  it('vuelve con el usuario intacto', () => {
    const token = signPayload({ userId: 'u1', expiresAt: 2_000 }, SECRET);
    expect(verifyPayload(token, SECRET, isAccessToken, 1_000)).toEqual({ userId: 'u1', expiresAt: 2_000 });
  });

  it('no vale una vez caducado', () => {
    const token = signPayload({ userId: 'u1', expiresAt: 2_000 }, SECRET);
    expect(verifyPayload(token, SECRET, isAccessToken, 3_000)).toBeNull();
  });

  it('no vale con otro secreto', () => {
    const token = signPayload({ userId: 'u1', expiresAt: 2_000 }, SECRET);
    expect(verifyPayload(token, 'otro-secreto-distinto', isAccessToken, 1_000)).toBeNull();
  });

  it('cambiar el usuario invalida la firma, que es el ataque evidente', () => {
    const token = signPayload({ userId: 'u1', expiresAt: 2_000 }, SECRET);
    const [, firma] = token.split('.');
    const otro = Buffer.from(JSON.stringify({ userId: 'admin', expiresAt: 2_000 })).toString(
      'base64url',
    );

    expect(verifyPayload(`${otro}.${firma}`, SECRET, isAccessToken, 1_000)).toBeNull();
  });

  it('no se traga cualquier cosa con forma de token', () => {
    expect(verifyPayload('', SECRET, isAccessToken)).toBeNull();
    expect(verifyPayload('sin-punto', SECRET, isAccessToken)).toBeNull();
    expect(verifyPayload('.', SECRET, isAccessToken)).toBeNull();
    expect(verifyPayload('bm8tZXMtanNvbg.firma', SECRET, isAccessToken)).toBeNull();
  });
});
