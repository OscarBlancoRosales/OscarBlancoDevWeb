import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { shuffle } from '@devweb/shared/engine/rng';
import { OPCIONES } from '@devweb/shared/games/trivial/tipos';
import type { Static } from '@sinclair/typebox';
import type { Rng } from '@devweb/shared/engine/rng';
import type { Pregunta, TipoPrueba } from '@devweb/shared/games/trivial/tipos';

/**
 * La forma en que se le pide una pregunta al modelo.
 *
 * Dos decisiones deciden cuántas sobreviven:
 *
 * `respuesta` va **escrita**, no numerada. Los modelos cuentan fatal -dicen «la
 * 2» queriendo decir la tercera, o cuentan desde uno- y en cambio aciertan al
 * escribir cuál es. El índice lo sacamos nosotros buscándola.
 *
 * Y las opciones las barajamos aquí. Un modelo pone la buena la primera mucho
 * más de lo que el azar permitiría, y contar sin leer no puede ser una
 * estrategia ganadora.
 */
export const PreguntaInventada = Type.Object(
  {
    enunciado: Type.String({ minLength: 10, maxLength: 300 }),
    codigo: Type.Optional(Type.String({ maxLength: 600 })),
    opciones: Type.Array(Type.String({ minLength: 1, maxLength: 140 }), { maxItems: 4 }),
    respuesta: Type.String({ minLength: 1, maxLength: 140 }),
    explicacion: Type.String({ minLength: 10, maxLength: 400 }),
    dificultad: Type.Integer({ minimum: 1, maximum: 5 }),
    /** Solo en las estimaciones: el error a partir del cual ya no se puntúa. */
    margen: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

export type PreguntaInventada = Static<typeof PreguntaInventada>;

/** Las dos únicas opciones de la ráfaga. No las decide el modelo. */
const VERDADERO_O_FALSO = ['Verdadero', 'Falso'] as const;

/** Lo que sale de una pregunta cruda, ya sin la respuesta ni la dificultad. */
type Base = Omit<Pregunta, 'opciones' | 'correcta'>;

/**
 * Una pregunta de verdad a partir de lo que devolvió el modelo, o `null`.
 *
 * `null` no es una excepción: es lo normal unas cuantas veces por programa. Lo
 * que devuelva null lo rellena el banco, así que una sala nunca se queda con
 * menos rondas de las que tiene que tener.
 */
export function aPregunta(
  tipo: TipoPrueba,
  cruda: unknown,
  id: string,
  rng: Rng,
): Pregunta | null {
  if (!Value.Check(PreguntaInventada, cruda)) return null;

  const base: Base = {
    id,
    tipo,
    enunciado: cruda.enunciado.trim(),
    explicacion: cruda.explicacion.trim(),
    dificultad: cruda.dificultad as 1 | 2 | 3 | 4 | 5,
    ...(cruda.codigo ? { codigo: cruda.codigo } : {}),
  };

  if (tipo === 'estimacion') return estimacion(base, cruda);
  if (tipo === 'rafaga') return verdaderoOFalso(base, cruda);
  return deOpciones(base, cruda, rng);
}

function estimacion(base: Base, cruda: PreguntaInventada): Pregunta | null {
  // Se quita todo lo que no sea cifra porque contestan «unos 2005» o «2005 d.C.»
  // y sería una pena tirar eso. Pero si no queda ni un dígito, no hay número:
  // `Number('')` vale cero, y un cero colado aquí es una respuesta inventada.
  const cifras = cruda.respuesta.replace(/[^\d.,-]/g, '').replace(',', '.');
  if (!/\d/.test(cifras)) return null;

  const numero = Number(cifras);
  // Sin margen no se puede puntuar con justicia: fallar por veinte en un año es
  // fallar, y fallar por veinte en «cuántos millones de líneas» es bordarlo.
  if (!Number.isFinite(numero) || cruda.margen === undefined) return null;

  return { ...base, opciones: [], correcta: Math.round(numero), margen: cruda.margen };
}

function verdaderoOFalso(base: Base, cruda: PreguntaInventada): Pregunta | null {
  const dicha = normalizar(cruda.respuesta);
  const cual = VERDADERO_O_FALSO.findIndex((una) => normalizar(una) === dicha);
  if (cual < 0) return null;

  // No se barajan. Que el sitio del «verdadero» cambie en una prueba que se
  // contesta en diez segundos es una crueldad, no una dificultad.
  return { ...base, opciones: [...VERDADERO_O_FALSO], correcta: cual };
}

function deOpciones(base: Base, cruda: PreguntaInventada, rng: Rng): Pregunta | null {
  if (cruda.opciones.length !== OPCIONES) return null;

  const limpias = cruda.opciones.map((una) => una.trim());
  const normalizadas = limpias.map(normalizar);
  // Con dos opciones iguales, «cuál es la buena» deja de tener respuesta.
  if (new Set(normalizadas).size !== limpias.length) return null;

  const dicha = normalizar(cruda.respuesta);
  if (!normalizadas.includes(dicha)) return null;

  const barajadas = shuffle(limpias, rng);
  return {
    ...base,
    opciones: barajadas,
    correcta: barajadas.findIndex((una) => normalizar(una) === dicha),
  };
}

/**
 * La forma en que se comparan dos respuestas.
 *
 * El modelo envuelve: contesta «B) 443», «"443"» o « 443 » queriendo decir lo
 * mismo. Tirar la pregunta por eso sería tirar preguntas buenas por la
 * puntuación.
 */
function normalizar(texto: string): string {
  return texto
    .trim()
    .replace(/^[a-dA-D][).:-]\s*/, '')
    .replace(/^["'«»*]+|["'«»*]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
