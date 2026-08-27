/**
 * Lo único que el dominio sabe del entorno donde corre.
 *
 * `packages/shared` lo consumen el navegador y el servidor, así que no puede
 * nombrar `window` ni `localStorage`: en Node no existen y ni siquiera declaran
 * un tipo. Aquí se accede a ellos a través de `globalThis`, con la forma mínima
 * que de verdad se usa, y el resto del paquete pide lo que necesita a estas dos
 * funciones. Una regla de ESLint impide volver a escribirlos sueltos.
 */

/** Lo que el dominio usa de un almacén de clave/valor. Ni un método más. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface BrowserGlobals {
  readonly location?: { readonly origin?: unknown };
  readonly localStorage?: unknown;
}

function globals(): BrowserGlobals {
  return globalThis;
}

/** El origen de la página, o el que se pase si no hay página. */
export function currentOrigin(fallback: string): string {
  const origin = globals().location?.origin;
  return typeof origin === 'string' && origin.length > 0 ? origin : fallback;
}

/**
 * El almacén del navegador, si lo hay y deja usarse.
 *
 * Puede existir y aun así lanzar: en modo privado, o con las cookies de sitio
 * bloqueadas, el mero hecho de leerlo es una excepción.
 */
export function browserStorage(): KeyValueStorage | undefined {
  try {
    const candidate = globals().localStorage;
    return isKeyValueStorage(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function isKeyValueStorage(value: unknown): value is KeyValueStorage {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<KeyValueStorage>;
  return (
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function'
  );
}
