import { describe, expect, it } from 'vitest';
import {
  generateToken,
  hashToken,
  isAccessToken,
  isSeatToken,
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

describe('pase de invitado', () => {
  const payload = { roomId: 'sala-1', seatId: 'asiento-1', expiresAt: 2_000 };

  it('vale para la sala y el asiento con los que se firmó', () => {
    const token = signPayload(payload, SECRET);
    expect(verifyPayload(token, SECRET, isSeatToken, 1_000)).toEqual(payload);
  });

  it('no vale una vez caducado', () => {
    const token = signPayload(payload, SECRET);
    expect(verifyPayload(token, SECRET, isSeatToken, 3_000)).toBeNull();
  });

  it('no vale con otro secreto', () => {
    const token = signPayload(payload, SECRET);
    expect(verifyPayload(token, 'otro-secreto-distinto', isSeatToken, 1_000)).toBeNull();
  });

  it('cambiar la sala invalida la firma, que es el ataque evidente', () => {
    const token = signPayload(payload, SECRET);
    const [, signature] = token.split('.');
    const otraSala = Buffer.from(
      JSON.stringify({ ...payload, roomId: 'sala-de-otro' }),
    ).toString('base64url');

    expect(verifyPayload(`${otraSala}.${signature}`, SECRET, isSeatToken, 1_000)).toBeNull();
  });

  it('no se traga cualquier cosa con forma de token', () => {
    expect(verifyPayload('', SECRET, isSeatToken)).toBeNull();
    expect(verifyPayload('sin-punto', SECRET, isSeatToken)).toBeNull();
    expect(verifyPayload('.', SECRET, isSeatToken)).toBeNull();
    expect(verifyPayload('bm8tZXMtanNvbg.firma', SECRET, isSeatToken)).toBeNull();
  });
});

describe('token de acceso', () => {
  it('vuelve con el usuario intacto', () => {
    const token = signPayload({ userId: 'u1', expiresAt: 2_000 }, SECRET);
    expect(verifyPayload(token, SECRET, isAccessToken, 1_000)).toEqual({ userId: 'u1', expiresAt: 2_000 });
  });

  it('un pase de invitado no cuela como token de acceso', () => {
    const pase = signPayload({ roomId: 'r', seatId: 's', expiresAt: 2_000 }, SECRET);
    expect(verifyPayload(pase, SECRET, isAccessToken, 1_000)).toBeNull();
  });

  it('y un token de acceso no cuela como pase de invitado', () => {
    const acceso = signPayload({ userId: 'u1', expiresAt: 2_000 }, SECRET);
    expect(verifyPayload(acceso, SECRET, isSeatToken, 1_000)).toBeNull();
  });
});
