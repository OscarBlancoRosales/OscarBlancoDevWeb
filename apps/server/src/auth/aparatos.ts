/**
 * Qué aparato hay detrás de un user-agent.
 *
 * Un user-agent no es una fuente fiable: lo escribe el cliente y se puede
 * poner lo que quiera. Aquí no se usa para decidir nada, solo para que en el
 * panel se lea «Chrome en Windows» en vez de ciento veinte caracteres de
 * paréntesis, y puedas reconocer de un vistazo cuál de esas sesiones es la
 * tuya. Lo que decide sigue siendo la familia de refrescos.
 */

const NAVEGADORES: readonly (readonly [RegExp, string])[] = [
  // El orden importa: Edge y Opera también dicen Chrome, y Chrome dice Safari.
  [/\bEdgA?\/|\bEdge\//, 'Edge'],
  [/\bOPR\/|\bOpera\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bCriOS\/|\bChrome\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
  [/\bcurl\//, 'curl'],
];

const SISTEMAS: readonly (readonly [RegExp, string])[] = [
  [/\bWindows NT\b/, 'Windows'],
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bAndroid\b/, 'Android'],
  [/\bMac OS X\b|\bMacintosh\b/, 'Mac'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bLinux\b/, 'Linux'],
];

export function describirAparato(userAgent: string | null): string {
  if (!userAgent) return 'desconocido';

  const navegador = NAVEGADORES.find(([patron]) => patron.test(userAgent))?.[1];
  const sistema = SISTEMAS.find(([patron]) => patron.test(userAgent))?.[1];

  if (navegador && sistema) return `${navegador} en ${sistema}`;
  return navegador ?? sistema ?? 'desconocido';
}
