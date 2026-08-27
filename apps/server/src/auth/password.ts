import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id con los parámetros que recomienda OWASP para 2024 en adelante.
 *
 * 19 MiB y dos iteraciones no se eligen por gusto: es el punto donde comprobar
 * una contraseña sigue siendo instantáneo para una persona y sale caro para
 * quien prueba millones. Bajar la memoria es lo que más ayuda a un atacante con
 * GPU, así que es lo último que se toca.
 */
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/**
 * Comprueba una contraseña sin distinguir "hash corrupto" de "no coincide".
 *
 * Un error al verificar tiene que ser indistinguible de un fallo normal: si un
 * hash roto lanzara una excepción y una contraseña mala devolviera `false`, la
 * diferencia entre las dos respuestas contaría algo sobre la cuenta.
 */
export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password, OPTIONS);
  } catch {
    return false;
  }
}

let señuelo: Promise<string> | null = null;

/**
 * Gasta el mismo tiempo que comprobar una contraseña de verdad.
 *
 * Sin esto, un correo que no existe se contesta en un milisegundo y uno que sí
 * existe tarda lo que tarda Argon2 con 19 MiB. Un cronómetro basta para saber
 * qué cuentas hay registradas, por mucho que el mensaje de error sea idéntico.
 *
 * El hash señuelo se calcula una sola vez, sobre una contraseña aleatoria que
 * nadie conoce, y nunca coincide.
 */
export async function wastePasswordTime(password: string): Promise<void> {
  señuelo ??= hashPassword(randomBytes(32).toString('hex'));
  await verifyPassword(await señuelo, password);
}
