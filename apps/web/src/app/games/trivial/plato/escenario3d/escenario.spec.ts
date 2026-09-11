import { describe, expect, it } from 'vitest';
import {
  ACERCAMIENTO,
  LO_QUE_SACUDE,
  RESOLUCION_MAXIMA,
  SACUDIDA_MAXIMA,
  fuerzaDeLaSacudida,
  puntoDeMira,
  separacionPara,
  sitioDe,
} from './escenario';
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

describe('el latigazo hacia quien tiene la bomba', () => {
  it('la cámara se gira hacia su lado', () => {
    const x = sitioDe(3, 4);

    expect(puntoDeMira(x)).toBeGreaterThan(0);
    expect(puntoDeMira(-x)).toBeLessThan(0);
  });

  it('pero no se planta delante: la pregunta tiene que seguir viéndose', () => {
    const extremo = sitioDe(7, 8);

    expect(Math.abs(puntoDeMira(extremo))).toBeLessThan(Math.abs(extremo));
  });

  it('y en el centro no se gira nada', () => {
    expect(puntoDeMira(0)).toBe(0);
  });
});

describe('la sacudida de la explosión', () => {
  it('empieza a tope', () => {
    expect(fuerzaDeLaSacudida(0)).toBe(1);
  });

  it('se va apagando', () => {
    expect(fuerzaDeLaSacudida(500)).toBeLessThan(fuerzaDeLaSacudida(100));
  });

  it('y se acaba sola', () => {
    // Sin esto, una explosión dejaría el plató temblando el resto del
    // programa: nadie vuelve a apagar lo que nadie enciende.
    expect(fuerzaDeLaSacudida(LO_QUE_SACUDE)).toBe(0);
    expect(fuerzaDeLaSacudida(9_000)).toBe(0);
  });

  it('nunca antes de tiempo', () => {
    expect(fuerzaDeLaSacudida(-10)).toBe(0);
  });

  it('sacude lo justo para que se note y no para marear', () => {
    expect(SACUDIDA_MAXIMA).toBeLessThan(0.3);
    expect(LO_QUE_SACUDE).toBeLessThan(1_500);
  });
});
