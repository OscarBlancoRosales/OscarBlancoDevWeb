import { randomUUID } from 'node:crypto';
import { createAuthRepository } from './repository';
import { generateToken, hashToken } from './tokens';
import type { Db } from '../db/index';

/**
 * Una invitación válida, para los tests que necesitan dar de alta a alguien.
 *
 * El alta es por invitación, así que sin esto la mitad de las pruebas tendrían
 * que montar un administrador y pasar por el panel solo para llegar a lo que de
 * verdad quieren probar. Se escribe directamente en la base, que es el atajo
 * honesto: no salta ninguna comprobación del servicio, solo prepara el terreno.
 */
export function invitacionDePrueba(db: Db, now: number = Date.now()): string {
  const token = generateToken();
  createAuthRepository(db).insertInvitation({
    id: randomUUID(),
    tokenHash: hashToken(token),
    note: 'de prueba',
    createdBy: null,
    createdAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    usedAt: null,
    usedBy: null,
  });
  return token;
}
