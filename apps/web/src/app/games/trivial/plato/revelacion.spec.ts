import { describe, expect, it } from 'vitest';
import {
  CADA_APUESTA,
  LO_QUE_DURA,
  REVELACION,
  cuandoEmpieza,
  pasoEn,
  seApagan,
  seEnciende,
  seExplica,
  turnoDeCantar,
} from './revelacion';
import { SEGUNDOS_PARA_PASAR } from '@devweb/shared/games/trivial/reglas';
import type { Paso } from './revelacion';

describe('el destape de la respuesta', () => {
  it('empieza en silencio, sin marcar nada', () => {
    expect(pasoEn(0)).toBe('silencio');
    expect(seEnciende('silencio')).toBe(false);
  });

  it('primero se enciende la buena y las demás siguen ahí', () => {
    const paso = pasoEn(500);

    expect(paso).toBe('enciende');
    expect(seEnciende(paso)).toBe(true);
    expect(seApagan(paso)).toBe(false);
  });

  it('después se apagan las que no eran', () => {
    expect(seApagan(pasoEn(1_000))).toBe(true);
  });

  it('y la explicación es lo último', () => {
    // Si el botón de seguir sale antes que la respuesta, nadie se entera de
    // nada: la mitad de la mesa lo pulsa sin haber mirado.
    expect(seExplica(pasoEn(1_000))).toBe(false);
    expect(seExplica(pasoEn(LO_QUE_DURA))).toBe(true);
  });

  it('los pasos van en orden y ninguno se repite', () => {
    const pasos = REVELACION.map((tramo) => tramo.paso);

    expect(pasos).toEqual(['silencio', 'enciende', 'apaga', 'listo']);
    expect(new Set(pasos).size).toBe(pasos.length);
  });

  it('los tiempos crecen', () => {
    for (const [i, tramo] of REVELACION.entries()) {
      if (i === 0) continue;
      expect(tramo.enMs, tramo.paso).toBeGreaterThan(REVELACION[i - 1].enMs);
    }
  });

  it('entero se ve en menos de dos segundos', () => {
    // Un destape que se hace largo deja de ser un efecto y pasa a ser una
    // espera. En la ronda quince se nota mucho.
    expect(LO_QUE_DURA).toBeLessThan(2_000);
  });

  it('y da tiempo a verlo antes de que la ronda pase sola', () => {
    // Las pruebas de ritmo avanzan sin que nadie pulse. Si el destape durase
    // más que la más corta de ellas, la ronda cambiaría con la respuesta
    // todavía sin enseñar.
    const masCorta = Math.min(...Object.values(SEGUNDOS_PARA_PASAR).filter((s) => s > 0));

    expect(LO_QUE_DURA).toBeLessThan(masCorta * 1_000);
  });

  it('y mucho después sigue estando destapada', () => {
    // Quien entra en una ronda ya cerrada no ve una animación a medias.
    expect(pasoEn(60_000)).toBe('listo');
  });

  it('cada paso sabe lo que deja ver', () => {
    const todos: Paso[] = ['silencio', 'enciende', 'apaga', 'listo'];
    const cuantas = todos.filter((paso) => seEnciende(paso)).length;

    expect(cuantas).toBe(3);
  });
});

describe('cantar las apuestas', () => {
  it('se cantan de último a primero', () => {
    // La clasificación viene de más a menos puntos, así que el primero de la
    // lista es el último en cantar: es el que tiene que decidir sabiendo ya
    // lo que se juegan los demás.
    expect(turnoDeCantar(3, 4)).toBe(0);
    expect(turnoDeCantar(0, 4)).toBe(3);
  });

  it('cada uno canta una sola vez', () => {
    const turnos = [0, 1, 2, 3].map((i) => turnoDeCantar(i, 4));

    expect(new Set(turnos).size).toBe(4);
    expect(Math.min(...turnos)).toBe(0);
    expect(Math.max(...turnos)).toBe(3);
  });

  it('y cuatro se cantan en menos de tres segundos', () => {
    expect(CADA_APUESTA * 4).toBeLessThan(3_000);
  });
});

describe('cuándo empieza cada paso', () => {
  it('el silencio es lo primero', () => {
    expect(cuandoEmpieza('silencio')).toBe(0);
  });

  it('y encender va antes que apagar', () => {
    expect(cuandoEmpieza('enciende')).toBeLessThan(cuandoEmpieza('apaga'));
  });
});
