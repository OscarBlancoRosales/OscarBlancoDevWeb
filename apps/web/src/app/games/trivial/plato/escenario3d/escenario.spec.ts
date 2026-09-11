import { describe, expect, it } from 'vitest';
import { ACERCAMIENTO, RESOLUCION_MAXIMA, separacionPara, sitioDe } from './escenario';
import type { Golpe } from '../escena';

/**
 * Las cuentas del escenario.
 *
 * Lo que se puede probar de un plató 3D sin GPU es justo esto: dónde va cada
 * cosa y cuánto se mueve la cámara. Si está guapo no lo dice ninguna prueba.
 */
describe('la fila de atriles', () => {
  it('va centrada en el origen', () => {
    const sitios = [0, 1, 2, 3].map((i) => sitioDe(i, 4));
    const suma = sitios.reduce((total, uno) => total + uno, 0);

    expect(Math.abs(suma)).toBeLessThan(0.0001);
  });

  it('con uno solo, en el centro', () => {
    expect(sitioDe(0, 1)).toBe(0);
  });

  it('se van apretando según entra más gente', () => {
    expect(separacionPara(6)).toBeLessThan(separacionPara(3));
  });

  it('pero nunca se separan tanto que se salgan del plató', () => {
    // Con dos jugadores, sin tope, quedarían uno en cada esquina del escenario
    // y la pregunta en medio de un descampado.
    expect(separacionPara(2)).toBeLessThanOrEqual(1.9);
  });

  it('y con ocho siguen cabiendo', () => {
    const extremo = Math.abs(sitioDe(7, 8));
    expect(extremo).toBeLessThan(4);
  });
});

describe('los acercamientos de cámara', () => {
  it('todos los golpes dicen a dónde va la cámara', () => {
    const todos: Golpe[] = ['arranca', 'seccion', 'pregunta', 'resuelve', 'apuestas', 'podio'];
    for (const golpe of todos) expect(ACERCAMIENTO[golpe], golpe).toBeGreaterThan(0);
  });

  it('la cortinilla y el podio se acercan más que una pregunta cualquiera', () => {
    // Son los momentos en los que el juego está parado: es cuando la cámara
    // puede permitirse contar algo.
    expect(ACERCAMIENTO.seccion).toBeLessThan(ACERCAMIENTO.pregunta);
    expect(ACERCAMIENTO.podio).toBeLessThan(ACERCAMIENTO.pregunta);
  });

  it('y la entradilla se abre, que es lo contrario', () => {
    expect(ACERCAMIENTO.arranca).toBeGreaterThan(1);
  });
});

describe('el cuidado con el móvil', () => {
  it('no se le piden al navegador más píxeles de los que hacen falta', () => {
    // Un móvil moderno dice que tiene tres píxeles por punto. Pintar a esa
    // resolución un plató entero es calentar el teléfono para nada.
    expect(RESOLUCION_MAXIMA).toBeLessThanOrEqual(2);
  });
});
