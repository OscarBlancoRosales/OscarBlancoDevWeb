/**
 * Dónde vive la API.
 *
 * Se decide mirando el host en vez de con ficheros de entorno porque el
 * despliegue es un único bundle estático que sirve GitHub Pages: no hay una
 * compilación distinta por entorno donde poner la diferencia.
 */
export function apiBaseUrl(host: string = location.hostname): string {
  const enLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  return enLocal ? 'http://localhost:3000' : 'https://api.oscarblancorosales.com';
}

export function apiSocketUrl(host: string = location.hostname): string {
  return apiBaseUrl(host).replace(/^http/, 'ws');
}
