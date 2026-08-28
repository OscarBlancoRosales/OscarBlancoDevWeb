import { describe, expect, it } from 'vitest';
import {
  COLOCACION_VACIA,
  completa,
  girar,
  poner,
  quitarUltimo,
  siguienteTamano,
  vaciar,
} from './colocacion';
import { validarFlota } from '@devweb/shared/games/flota/reglas';
import type { Colocacion } from './colocacion';

/** Los cinco barcos puestos en fila, uno por línea. */
function flotaEntera(): Colocacion {
  let colocacion = COLOCACION_VACIA;
  for (let fila = 0; fila < 5; fila++) colocacion = poner(colocacion, fila, 0);
  return colocacion;
}

describe('el orden de la flota', () => {
  it('empieza por el barco mas grande', () => {
    expect(siguienteTamano(COLOCACION_VACIA)).toBe(5);
  });

  it('va bajando de tamano segun se colocan', () => {
    const uno = poner(COLOCACION_VACIA, 0, 0);
    expect(siguienteTamano(uno)).toBe(4);
  });

  it('cuando estan los cinco ya no toca ninguno', () => {
    const flota = flotaEntera();
    expect(completa(flota)).toBe(true);
    expect(siguienteTamano(flota)).toBeNull();
  });

  it('los cinco puestos forman una flota que el servidor acepta', () => {
    expect(validarFlota(flotaEntera().puestos)).toBeNull();
  });
});

describe('poner', () => {
  it('coloca el barco con la proa donde se pulsa', () => {
    const una = poner(COLOCACION_VACIA, 3, 2);
    expect(una.puestos[0]).toEqual({
      fila: 3,
      columna: 2,
      tamano: 5,
      orientacion: 'horizontal',
    });
  });

  it('no coloca un barco que se saldria del tablero', () => {
    const fuera = poner(COLOCACION_VACIA, 0, 8);
    expect(fuera.puestos).toHaveLength(0);
  });

  it('no coloca un barco encima de otro', () => {
    const una = poner(COLOCACION_VACIA, 0, 0);
    const dos = poner(una, 0, 0);
    expect(dos.puestos).toHaveLength(1);
  });

  it('deja poner un barco pegado al anterior', () => {
    const una = poner(COLOCACION_VACIA, 0, 0);
    const dos = poner(una, 0, 5);
    expect(dos.puestos).toHaveLength(2);
  });

  it('no coloca nada cuando ya estan los cinco', () => {
    const sexto = poner(flotaEntera(), 9, 0);
    expect(sexto.puestos).toHaveLength(5);
  });
});

describe('girar', () => {
  it('cambia la orientacion del siguiente barco', () => {
    const derecho = poner(girar(COLOCACION_VACIA), 0, 0);
    expect(derecho.puestos[0]?.orientacion).toBe('vertical');
  });

  it('conserva los barcos ya puestos', () => {
    const una = poner(COLOCACION_VACIA, 0, 0);
    expect(girar(una).puestos).toHaveLength(1);
  });
});

describe('deshacer', () => {
  it('quitar el ultimo devuelve su tamano a la cola', () => {
    const una = poner(COLOCACION_VACIA, 0, 0);
    expect(siguienteTamano(quitarUltimo(una))).toBe(5);
  });

  it('quitar sobre una colocacion vacia no rompe nada', () => {
    expect(quitarUltimo(COLOCACION_VACIA).puestos).toHaveLength(0);
  });

  it('vaciar deja la flota entera por poner', () => {
    expect(vaciar(flotaEntera()).puestos).toHaveLength(0);
  });
});
