import { describe, expect, it } from 'vitest';
import { DURACION, golpeEntre, seSalta } from './escena';
import type { Golpe } from './escena';
import type { TrivialView } from '@devweb/shared/games/trivial/tipos';

/**
 * El director de escena.
 *
 * Decide qué está contando el plató comparando dos vistas, igual que el
 * presentador decide qué decir comparando dos estados. Al ser una función pura
 * se prueba sin navegador y sale igual en las cinco pantallas de la mesa.
 */
const BASE: TrivialView = {
  fase: 'ronda',
  ronda: 1,
  rondas: 21,
  tipo: 'test',
  enunciado: '¿Sí o no?',
  codigo: null,
  dificultad: null,
  opciones: ['no', 'sí', 'quizá', 'nunca'],
  cerrada: false,
  hanRespondido: [],
  tuRespuesta: null,
  puntos: {},
  correcta: null,
  explicacion: null,
  resultados: null,
  turno: null,
  mecha: 0,
  cierraEn: 0,
  hanApostado: [],
  tuApuesta: null,
  apuestas: null,
  inventadas: false,
  impugnan: 0,
  hacenFalta: 0,
  tuImpugnas: false,
  tuTurno: true,
  racha: 0,
  dice: '',
  momento: '',
};

function vista(cambios: Partial<TrivialView> = {}): TrivialView {
  return { ...BASE, ...cambios };
}

describe('qué está contando el plató', () => {
  it('al arrancar el programa, la entradilla', () => {
    const antes = vista({ fase: 'presentacion', tipo: null });
    expect(golpeEntre(antes, vista())?.golpe).toBe('arranca');
  });

  it('y también si se entra con la partida ya empezada', () => {
    // Quien recarga la página en mitad del programa no tiene vista anterior.
    expect(golpeEntre(null, vista())?.golpe).toBe('arranca');
  });

  it('al cambiar de prueba, la cortinilla', () => {
    const cambio = golpeEntre(vista({ tipo: 'test' }), vista({ tipo: 'bomba', ronda: 4 }));

    expect(cambio?.golpe).toBe('seccion');
    expect(cambio?.seccion).toBe('bomba');
  });

  it('pero no en cada pregunta de la misma prueba', () => {
    // Es la diferencia entre un programa con secciones y una tanda de
    // preguntas con un cartel delante de cada una.
    const cambio = golpeEntre(vista({ ronda: 2 }), vista({ ronda: 3 }));
    expect(cambio?.golpe).toBe('pregunta');
  });

  it('al cerrarse la ronda, la revelación', () => {
    const cambio = golpeEntre(vista({ cerrada: false }), vista({ cerrada: true, correcta: 1 }));
    expect(cambio?.golpe).toBe('resuelve');
  });

  it('al abrirse la final, las apuestas', () => {
    const antes = vista({ tipo: 'bomba' });
    const cambio = golpeEntre(antes, vista({ fase: 'apuestas', tipo: 'final' }));

    expect(cambio?.golpe).toBe('apuestas');
    expect(cambio?.seccion).toBe('final');
  });

  it('y al acabarse el programa, el podio, por encima de todo lo demás', () => {
    // Aunque a la vez cambie la prueba o se cierre la ronda: lo que hay que
    // contar es que se ha acabado.
    const antes = vista({ tipo: 'final', cerrada: false });
    const cambio = golpeEntre(antes, vista({ fase: 'fin', tipo: 'final', cerrada: true }));

    expect(cambio?.golpe).toBe('podio');
  });

  it('si no ha pasado nada, no hay golpe', () => {
    expect(golpeEntre(vista(), vista())).toBeNull();
  });

  it('y contestar no es un golpe: el juego no se para por eso', () => {
    const antes = vista();
    const ahora = vista({ hanRespondido: ['a'], tuRespuesta: 2 });

    expect(golpeEntre(antes, ahora)).toBeNull();
  });
});

describe('los tiempos', () => {
  it('todos los golpes duran algo', () => {
    const todos: Golpe[] = ['arranca', 'seccion', 'pregunta', 'resuelve', 'apuestas', 'podio'];
    for (const golpe of todos) expect(DURACION[golpe], golpe).toBeGreaterThan(0);
  });

  it('la cortinilla para el juego y lo demás es un parpadeo', () => {
    expect(DURACION.seccion).toBeGreaterThan(DURACION.pregunta * 2);
    expect(DURACION.pregunta).toBeLessThan(1_000);
  });

  it('ninguno dura tanto como para comerse una ronda', () => {
    // La ráfaga se contesta en diez segundos. Un golpe de cuatro segundos
    // encima de eso no es un efecto, es quitarle el turno a alguien.
    for (const duracion of Object.values(DURACION)) {
      expect(duracion).toBeLessThan(5_000);
    }
  });
});

describe('saltarse los golpes', () => {
  it('los que paran el juego se pueden saltar', () => {
    expect(seSalta('seccion')).toBe(true);
    expect(seSalta('arranca')).toBe(true);
  });

  it('y los que son un parpadeo, no hace falta', () => {
    expect(seSalta('pregunta')).toBe(false);
    expect(seSalta('resuelve')).toBe(false);
  });
});
