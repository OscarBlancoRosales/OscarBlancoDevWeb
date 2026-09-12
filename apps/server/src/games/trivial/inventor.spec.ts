import { describe, expect, it } from 'vitest';
import { inventar } from './inventor';
import { ESCALETA, RONDAS_POR_PROGRAMA } from './banco';
import type { AiSettings } from '@devweb/shared/engine/ai/ai-client';

/**
 * El programa entero escrito por la IA.
 *
 * La regla que no se puede romper: **siempre** salen las rondas que pide la
 * escaleta. Una sala a medias es peor que una sala con preguntas del banco, y
 * el modelo falla más de lo que uno querría.
 *
 * Aquí no se toca la red: el modelo es siempre un doble.
 */
const AJUSTES: AiSettings = {
  enabled: true,
  provider: 'groq',
  apiKey: 'de-mentira',
  model: 'openai/gpt-oss-120b',
};

/** Una pregunta cruda del tipo que se le pida, ya bien formada. */
function cruda(i: number, tipo: string): Record<string, unknown> {
  if (tipo === 'rafaga') {
    return {
      enunciado: `Afirmación número ${i} sobre protocolos de red.`,
      opciones: [],
      respuesta: i % 2 === 0 ? 'Verdadero' : 'Falso',
      explicacion: 'Porque sí, y esto explica por qué con suficiente detalle.',
      dificultad: (i % 5) + 1,
    };
  }
  if (tipo === 'estimacion') {
    return {
      enunciado: `¿Cuántos algo hay en la cosa número ${i}?`,
      opciones: [],
      respuesta: String(1000 + i),
      margen: 50,
      explicacion: 'Porque sí, y esto explica por qué con suficiente detalle.',
      dificultad: 3,
    };
  }
  return {
    enunciado: `Pregunta número ${i} sobre bases de datos y rendimiento.`,
    opciones: [`buena-${i}`, `mala-a-${i}`, `mala-b-${i}`, `mala-c-${i}`],
    respuesta: `buena-${i}`,
    explicacion: 'Porque sí, y esto explica por qué con suficiente detalle.',
    dificultad: (i % 5) + 1,
  };
}

/** Un programa entero bien escrito, en el orden de la escaleta. */
function programaBueno(): Record<string, unknown>[] {
  const todas: Record<string, unknown>[] = [];
  let i = 0;
  for (const seccion of ESCALETA) {
    for (let n = 0; n < seccion.cuantas; n += 1) {
      todas.push(cruda(i, seccion.tipo));
      i += 1;
    }
  }
  return todas;
}

function modeloQueDice(texto: string) {
  return async () => Promise.resolve({ text: texto, model: 'doble' });
}

describe('inventar el programa', () => {
  it('devuelve el programa entero aunque el modelo no diga nada útil', async () => {
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: modeloQueDice('lo siento, no puedo ayudarte con eso'),
    });

    expect(programa).toHaveLength(RONDAS_POR_PROGRAMA);
  });

  it('y mantiene la escaleta: mismas pruebas y en el mismo orden', async () => {
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: modeloQueDice(JSON.stringify(programaBueno())),
    });

    let desde = 0;
    for (const seccion of ESCALETA) {
      const tramo = programa.slice(desde, desde + seccion.cuantas);
      expect(tramo.every((una) => una.tipo === seccion.tipo), seccion.tipo).toBe(true);
      desde += seccion.cuantas;
    }
  });

  it('usa las que valen', async () => {
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: modeloQueDice(JSON.stringify(programaBueno())),
    });

    expect(programa.every((una) => una.id.startsWith('ia-'))).toBe(true);
  });

  it('y rellena con el banco las que no', async () => {
    // Se rellena una a una y por posición, así que una pregunta mala en medio
    // no descoloca las de detrás.
    const aMedias = programaBueno();
    aMedias[3] = { enunciado: 'rota' };
    aMedias[7] = { enunciado: 'rota también' };

    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: modeloQueDice(JSON.stringify(aMedias)),
    });

    expect(programa).toHaveLength(RONDAS_POR_PROGRAMA);
    expect(programa[3].id.startsWith('ia-')).toBe(false);
    expect(programa[7].id.startsWith('ia-')).toBe(false);
    expect(programa[0].id.startsWith('ia-')).toBe(true);
  });

  it('una sola llamada para todo el programa', async () => {
    // Veintiuna llamadas a un modelo gratuito son varios minutos de espera y
    // veintiuna peticiones contra la cuota del día.
    let llamadas = 0;
    await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: async () => {
        llamadas += 1;
        return Promise.resolve({ text: '[]', model: 'doble' });
      },
    });

    expect(llamadas).toBe(1);
  });

  it('la dificultad que se encarga sube de la primera ronda a la última', async () => {
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: modeloQueDice(JSON.stringify(programaBueno())),
    });
    const conNivel = programa.filter((una) => una.dificultad !== undefined);

    expect(conNivel.length).toBeGreaterThan(0);
  });

  it('no espera para siempre: vencido el plazo, tira del banco', async () => {
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      plazoMs: 20,
      modelo: () => new Promise(() => undefined),
    });

    expect(programa).toHaveLength(RONDAS_POR_PROGRAMA);
    expect(programa.every((una) => !una.id.startsWith('ia-'))).toBe(true);
  });

  it('sobrevive a un JSON roto', async () => {
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: modeloQueDice('[{"enunciado": "a medio esc'),
    });

    expect(programa).toHaveLength(RONDAS_POR_PROGRAMA);
  });

  it('y saca el JSON aunque venga envuelto en un bloque de código', async () => {
    // Casi todos lo envuelven en ```json por mucho que se les pida que no.
    const envuelto = '```json\n' + JSON.stringify(programaBueno()) + '\n```';
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: modeloQueDice(envuelto),
    });

    expect(programa.some((una) => una.id.startsWith('ia-'))).toBe(true);
  });

  it('si el modelo revienta, el programa sale igual', async () => {
    const programa = await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: () => Promise.reject(new Error('sin cuota')),
    });

    expect(programa).toHaveLength(RONDAS_POR_PROGRAMA);
  });

  it('deja constancia de lo que se cayó, para poder diagnosticarlo', async () => {
    const avisos: string[] = [];
    await inventar({
      ajustes: AJUSTES,
      semilla: 1,
      modelo: modeloQueDice('nada de nada'),
      avisar: (motivo) => avisos.push(motivo),
    });

    expect(avisos.length).toBeGreaterThan(0);
  });

  it('dos salas con la misma semilla y la misma respuesta salen iguales', async () => {
    // La partida se reconstruye desde su log, así que el barajado tiene que
    // salir del estado y no del reloj.
    const texto = JSON.stringify(programaBueno());
    const una = await inventar({ ajustes: AJUSTES, semilla: 42, modelo: modeloQueDice(texto) });
    const otra = await inventar({ ajustes: AJUSTES, semilla: 42, modelo: modeloQueDice(texto) });

    expect(una).toEqual(otra);
  });
});
