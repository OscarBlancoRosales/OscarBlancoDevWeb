import { chatWithFallback } from '@devweb/shared/engine/ai/ai-client';
import { rngFor } from '@devweb/shared/engine/rng';
import { escaletaDe, repartir } from './banco';
import { aPregunta } from './inventor-esquema';
import { encargoDelPrograma } from './inventor-prompts';
import type { AiSettings } from '@devweb/shared/engine/ai/ai-client';
import type { Pregunta, Tema, TipoPrueba } from '@devweb/shared/games/trivial/tipos';

/**
 * Lo que se espera a que escriba el programa entero.
 *
 * Es una espera con alguien mirando la pantalla -se está creando la sala-, así
 * que no puede ser eterna. Pasado el plazo se juega con el banco, que siempre
 * está.
 */
const PLAZO_MS = 45_000;

/** Lo que se le deja escribir. Veintiuna preguntas caben de sobra. */
const TOKENS = 6_000;

type Llamada = typeof chatWithFallback;

export interface EncargoDelInventor {
  readonly ajustes: AiSettings;
  /** La semilla de la sala: manda en el barajado y en el relleno del banco. */
  readonly semilla: number;
  /** De qué va el programa. Decide la escaleta y de qué se le pide que escriba. */
  readonly tema?: Tema;
  readonly modelo?: Llamada;
  readonly plazoMs?: number;
  /** Dónde se apunta lo que se ha caído. Sin esto no hay diagnóstico. */
  readonly avisar?: (motivo: string) => void;
}

/**
 * El programa entero, escrito por la IA y rellenado con el banco.
 *
 * Devuelve **siempre** el programa completo, pase lo que pase con el modelo:
 * una sala con menos rondas de las que toca es peor que una sala con preguntas
 * del banco. Lo que no valida se sustituye una a una y por tipo, así que la
 * escaleta no se mueve ni aunque se caiga la llamada entera.
 */
export async function inventar(encargo: EncargoDelInventor): Promise<Pregunta[]> {
  const tema = encargo.tema ?? 'dev';
  const deReserva = repartir(encargo.semilla, tema);
  const crudas = await pedirlas(encargo);
  if (crudas.length === 0) {
    // Es el caso que más falta hace diagnosticar: la sala se abre igual, con el
    // banco, y desde fuera no se nota que la IA no ha escrito nada.
    encargo.avisar?.('el modelo no devolvió ni una pregunta; el programa sale entero del banco');
    return deReserva;
  }

  const rng = rngFor(encargo.semilla, 0, 'inventor');
  const programa: Pregunta[] = [];
  let leidas = 0;
  let caidas = 0;

  for (const [i, prevista] of previstas(tema).entries()) {
    const cruda = crudas[leidas];
    leidas += 1;

    const inventada = cruda === undefined ? null : aPregunta(prevista, cruda, `ia-${i + 1}`, rng);
    if (inventada) {
      programa.push(inventada);
      continue;
    }

    caidas += 1;
    programa.push(deReserva[i]);
  }

  if (caidas > 0) {
    encargo.avisar?.(`${caidas} de ${programa.length} preguntas inventadas no valían; van del banco`);
  }
  return programa;
}

/** Qué tipo de prueba toca en cada ronda, según la escaleta del tema. */
function previstas(tema: Tema): TipoPrueba[] {
  return escaletaDe(tema).flatMap((seccion) =>
    Array.from({ length: seccion.cuantas }, () => seccion.tipo),
  );
}

/**
 * Le pide el programa al modelo y devuelve lo que venga, sin validar.
 *
 * Nunca lanza: quedarse sin preguntas inventadas no puede impedir abrir una
 * sala, porque el banco cubre el hueco.
 */
async function pedirlas(encargo: EncargoDelInventor): Promise<unknown[]> {
  const llamar = encargo.modelo ?? chatWithFallback;

  try {
    const respuesta = await Promise.race([
      llamar(
        encargo.ajustes,
        [
          {
            role: 'system',
            content:
              (encargo.tema === 'general'
                ? 'Escribes preguntas de concurso de cultura general, del estilo de los concursos de televisión.'
                : 'Escribes preguntas de concurso para programadores.') +
              ' Contestas solo con JSON válido, sin explicaciones alrededor.',
          },
          { role: 'user', content: encargoDelPrograma(encargo.tema ?? 'dev') },
        ],
        { maxTokens: TOKENS },
      ),
      seAgota(encargo.plazoMs ?? PLAZO_MS),
    ]);

    return comoArray(respuesta.text);
  } catch (fallo) {
    encargo.avisar?.(
      fallo instanceof Error ? fallo.message : 'el modelo falló sin decir por qué',
    );
    return [];
  }
}

/**
 * El array JSON que haya dentro de lo que ha contestado.
 *
 * Se busca el primer `[` y el último `]` porque casi todos lo envuelven en un
 * bloque de código por mucho que se les pida que no. Si ni así hay JSON, se
 * devuelve vacío y el banco se encarga.
 */
function comoArray(texto: string): unknown[] {
  const abre = texto.indexOf('[');
  const cierra = texto.lastIndexOf(']');
  if (abre < 0 || cierra <= abre) return [];

  try {
    const leido: unknown = JSON.parse(texto.slice(abre, cierra + 1));
    return Array.isArray(leido) ? leido : [];
  } catch {
    return [];
  }
}

function seAgota(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error('el modelo tardó demasiado en escribir el programa'));
    }, ms);
  });
}
