import { describe, expect, it } from 'vitest';
import { BANCO, ESCALETA, RONDAS_POR_PROGRAMA, delTema, escaletaDe, repartir, rondasDe } from './banco';
import { BOMBA, FINAL, PULSA, RAFAGA } from './pruebas';
import { BANCO_RESCATADO } from './banco-rescatado';
import { OPCIONES } from '@devweb/shared/games/trivial/tipos';

describe('el banco', () => {
  it('tiene de sobra para una partida', () => {
    expect(BANCO.length).toBeGreaterThanOrEqual(RONDAS_POR_PROGRAMA);
  });

  it('tiene preguntas de las tres clases', () => {
    const clases = new Set(BANCO.map((pregunta) => pregunta.tipo));
    expect([...clases].sort()).toEqual(['estimacion', 'fallo', 'test']);
  });

  it('ninguna repite identificador, mire donde mire', () => {
    const ids = [...BANCO, ...PULSA, ...RAFAGA, ...BOMBA, ...BANCO_RESCATADO].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * Un identificador distinto no basta: `utf8-bytes` y `pulsa-utf8-bytes` eran
   * la misma pregunta con dos caras, y en un programa podían caer las dos.
   */
  it('ni repite enunciado, que es lo que de verdad se nota jugando', () => {
    const enunciados = [...BANCO, ...PULSA, ...RAFAGA, ...BOMBA, ...BANCO_RESCATADO].map((p) =>
      p.enunciado.toLowerCase().trim(),
    );
    expect(new Set(enunciados).size).toBe(enunciados.length);
  });

  it('las de opciones traen cuatro, y ninguna repetida', () => {
    for (const pregunta of BANCO.filter((p) => p.tipo !== 'estimacion')) {
      expect(pregunta.opciones, pregunta.id).toHaveLength(OPCIONES);
      expect(new Set(pregunta.opciones).size, pregunta.id).toBe(OPCIONES);
    }
  });

  it('la respuesta de una de opciones cae dentro del rango', () => {
    for (const pregunta of BANCO.filter((p) => p.tipo !== 'estimacion')) {
      expect(pregunta.correcta, pregunta.id).toBeGreaterThanOrEqual(0);
      expect(pregunta.correcta, pregunta.id).toBeLessThan(OPCIONES);
    }
  });

  it('las de pillar el fallo traen el codigo donde mirar', () => {
    for (const pregunta of BANCO.filter((p) => p.tipo === 'fallo')) {
      expect(pregunta.codigo, pregunta.id).toBeTruthy();
    }
  });

  it('las de estimacion no traen opciones, y si su margen', () => {
    for (const pregunta of BANCO.filter((p) => p.tipo === 'estimacion')) {
      expect(pregunta.opciones, pregunta.id).toHaveLength(0);
      expect(pregunta.margen, pregunta.id).toBeGreaterThan(0);
    }
  });

  it('todas explican la respuesta, que es la mitad de la gracia', () => {
    for (const pregunta of BANCO) {
      expect(pregunta.explicacion.length, pregunta.id).toBeGreaterThan(15);
      expect(pregunta.enunciado.length, pregunta.id).toBeGreaterThan(10);
    }
  });
});

/**
 * Vienen de otro formato y de otra época: las mismas exigencias que al resto,
 * porque en el programa suenan igual que las de siempre.
 */
describe('las preguntas rescatadas del banco viejo', () => {
  const conOpciones = BANCO_RESCATADO.filter((p) => p.tipo !== 'estimacion');

  it('las de opciones traen cuatro (o dos en la rafaga), y la buena entre ellas', () => {
    for (const pregunta of conOpciones) {
      const cuantas = pregunta.tipo === 'rafaga' ? 2 : OPCIONES;
      expect(pregunta.opciones, pregunta.id).toHaveLength(cuantas);
      expect(new Set(pregunta.opciones).size, pregunta.id).toBe(cuantas);
      expect(pregunta.correcta, pregunta.id).toBeGreaterThanOrEqual(0);
      expect(pregunta.correcta, pregunta.id).toBeLessThan(cuantas);
    }
  });

  it('las de estimacion traen un margen que no regala el punto', () => {
    for (const pregunta of BANCO_RESCATADO.filter((p) => p.tipo === 'estimacion')) {
      expect(pregunta.opciones, pregunta.id).toHaveLength(0);
      expect(pregunta.margen, pregunta.id).toBeGreaterThan(0);
      // Un año se falla en años. Un margen de ciento sesenta es acertar por
      // decir «el siglo XX», y así se coló al convertirlas la primera vez.
      expect(pregunta.margen ?? 0, pregunta.id).toBeLessThanOrEqual(
        Math.max(20, Math.abs(pregunta.correcta) * 0.15),
      );
    }
  });

  it('todas explican la respuesta: es la condición por la que entraron', () => {
    for (const pregunta of BANCO_RESCATADO) {
      expect(pregunta.explicacion.length, pregunta.id).toBeGreaterThan(15);
      expect(pregunta.enunciado.length, pregunta.id).toBeGreaterThan(10);
    }
  });

  it('la bomba se contesta con la mecha corriendo: enunciados cortos', () => {
    for (const pregunta of BANCO_RESCATADO.filter((p) => p.tipo === 'bomba')) {
      expect(pregunta.enunciado.length, pregunta.id).toBeLessThanOrEqual(62);
    }
  });
});

describe('la escaleta del programa', () => {
  it('reparte sin repetir ninguna', () => {
    const tanda = repartir(1);
    expect(new Set(tanda.map((pregunta) => pregunta.id)).size).toBe(tanda.length);
  });

  it('con la misma semilla da el mismo programa', () => {
    expect(repartir(42)).toEqual(repartir(42));
  });

  it('con semillas distintas cambian las preguntas', () => {
    expect(JSON.stringify(repartir(1))).not.toBe(JSON.stringify(repartir(2)));
  });

  /**
   * Un programa que cambia de forma cada noche no es un programa: la apertura,
   * la subida y el cierre van siempre en el mismo sitio.
   */
  it('pero el orden de las secciones es siempre el mismo', () => {
    const seccionesDe = (semilla: number) => {
      const tipos = repartir(semilla).map((pregunta) => pregunta.tipo);
      return tipos.filter((tipo, i) => tipo !== tipos[i - 1]);
    };
    expect(seccionesDe(1)).toEqual(seccionesDe(999));
  });

  it('sigue la escaleta que está escrita', () => {
    const tanda = repartir(3);
    let desde = 0;
    for (const seccion of ESCALETA) {
      const tramo = tanda.slice(desde, desde + seccion.cuantas);
      expect(tramo.length, seccion.tipo).toBe(seccion.cuantas);
      for (const pregunta of tramo) expect(pregunta.tipo, pregunta.id).toBe(seccion.tipo);
      desde += seccion.cuantas;
    }
    expect(tanda).toHaveLength(desde);
  });

  it('están las seis pruebas y la final, que es de lo que va el programa', () => {
    const clases = new Set(repartir(7).map((pregunta) => pregunta.tipo));
    expect(clases).toEqual(
      new Set(['test', 'pulsa', 'rafaga', 'fallo', 'estimacion', 'bomba', 'final']),
    );
  });

  /** Sin preguntas de sobra, dos partidas seguidas traen lo mismo. */
  it('hay más preguntas de las que caben en una partida', () => {
    for (const seccion of ESCALETA) {
      const hay = [...BANCO, ...PULSA, ...RAFAGA, ...BOMBA, ...FINAL].filter(
        (una) => una.tipo === seccion.tipo,
      );
      expect(hay.length, seccion.tipo).toBeGreaterThan(seccion.cuantas);
    }
  });

  /**
   * La bomba ya no cierra: cierra la final.
   *
   * Los vuelcos siguen estando en la bomba, pero el programa acaba apostando,
   * que es lo único que puede dar la vuelta a un marcador entero de golpe.
   */
  it('la bomba deja paso a la final, que es la que cierra', () => {
    const programa = repartir(5);
    expect(programa.at(-1)?.tipo).toBe('final');
    expect(programa.at(-2)?.tipo).toBe('bomba');
  });
});

describe('las preguntas de las pruebas nuevas', () => {
  const nuevas = [...PULSA, ...RAFAGA, ...BOMBA, ...FINAL];

  it('todas explican la respuesta', () => {
    for (const pregunta of nuevas) {
      expect(pregunta.explicacion.length, pregunta.id).toBeGreaterThan(15);
    }
  });

  it('la correcta siempre existe entre las opciones', () => {
    for (const pregunta of nuevas) {
      expect(pregunta.correcta, pregunta.id).toBeGreaterThanOrEqual(0);
      expect(pregunta.correcta, pregunta.id).toBeLessThan(pregunta.opciones.length);
    }
  });

  it('la ráfaga es de verdadero o falso, no de cuatro opciones', () => {
    for (const pregunta of RAFAGA) {
      expect(pregunta.opciones, pregunta.id).toEqual(['Verdadero', 'Falso']);
    }
  });

  /** Con la mecha corriendo no da tiempo a leerse un párrafo. */
  it('las de la bomba se leen de un vistazo', () => {
    for (const pregunta of BOMBA) {
      expect(pregunta.enunciado.length, pregunta.id).toBeLessThan(70);
    }
  });

  it('ninguna se repite con otra', () => {
    const todas = [...BANCO, ...nuevas];
    expect(new Set(todas.map((una) => una.id)).size).toBe(todas.length);
  });
});

/**
 * Las dos barajas, sin mezclarse.
 *
 * Un programa que te pone «¿qué devuelve typeof null?» y «¿en qué año fue la
 * peste negra?» en la misma tanda no es variado: es incoherente. Son dos
 * juegos distintos y se eligen al abrir la sala.
 */
describe('el tema del programa', () => {
  it('el de dev no trae ni una de cultura general', () => {
    const programa = repartir(7, 'dev');
    expect(programa.every((una) => (una.tema ?? 'dev') === 'dev')).toBe(true);
  });

  it('y el de cultura general no trae ni una de dev', () => {
    const programa = repartir(7, 'general');
    expect(programa.every((una) => una.tema === 'general')).toBe(true);
  });

  it('sin decir nada, el de siempre: dev', () => {
    expect(repartir(7)).toEqual(repartir(7, 'dev'));
  });

  it('los dos programas salen completos', () => {
    expect(repartir(3, 'dev')).toHaveLength(rondasDe('dev'));
    expect(repartir(3, 'general')).toHaveLength(rondasDe('general'));
  });

  it('los dos cierran con la final, que es lo que decide el concurso', () => {
    expect(repartir(5, 'dev').at(-1)?.tipo).toBe('final');
    expect(repartir(5, 'general').at(-1)?.tipo).toBe('final');
  });

  /**
   * «Encuentra el fallo» es leer código con un error dentro. Fuera de la
   * programación no hay código que leer, así que esa sección no existe.
   */
  it('el de cultura general no tiene la sección de encontrar el fallo', () => {
    expect(repartir(5, 'general').some((una) => una.tipo === 'fallo')).toBe(false);
  });

  it('y hay más preguntas de las que caben, para que dos partidas no repitan', () => {
    for (const tema of ['dev', 'general'] as const) {
      for (const seccion of escaletaDe(tema)) {
        const hay = delTema(tema).filter((una) => una.tipo === seccion.tipo);
        expect(hay.length, `${tema}/${seccion.tipo}`).toBeGreaterThan(seccion.cuantas);
      }
    }
  });

  it('dos partidas del mismo tema con semillas distintas no traen lo mismo', () => {
    const una = repartir(1, 'general').map((p) => p.id).join();
    const otra = repartir(2, 'general').map((p) => p.id).join();
    expect(una).not.toBe(otra);
  });
});
