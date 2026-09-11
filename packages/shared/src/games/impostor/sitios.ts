/**
 * Dónde se sienta cada uno alrededor de la mesa del Impostor.
 *
 * Óvalo, no rectángulo: aquí el paño es una elipse y repartir por ángulo
 * no amontona a nadie. El primero queda abajo del todo, que es tu sitio.
 * Devuelve por cientos, que es lo que la pantalla necesita.
 */

export function sitiosEnElOvalo(cuantos: number): { x: number; y: number }[] {
  if (cuantos <= 0) return [];
  return Array.from({ length: cuantos }, (_, i) => {
    const angulo = (2 * Math.PI * i) / cuantos + Math.PI / 2;
    return {
      x: 50 + 42 * Math.cos(angulo),
      y: 50 + 36 * Math.sin(angulo),
    };
  });
}
