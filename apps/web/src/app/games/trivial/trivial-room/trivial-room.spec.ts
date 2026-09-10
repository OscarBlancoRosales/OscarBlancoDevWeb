import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { signal } from '@angular/core';
import { TrivialRoom } from './trivial-room';
import { TrivialRoomService } from '../trivial-room.service';
import { guardarPase } from '../../pase-guardado';
import type { TrivialView } from '@devweb/shared/games/trivial/tipos';

/**
 * La pantalla del programa.
 *
 * Lo que se comprueba aquí es que cada prueba se juega como debe: en la bomba
 * contesta uno y los demás miran, y el presentador dice lo que manda el
 * servidor y no lo que se invente el navegador.
 */

const BASE: TrivialView = {
  fase: 'ronda',
  ronda: 1,
  rondas: 20,
  tipo: 'test',
  enunciado: '¿Sí o no?',
  codigo: null,
  opciones: ['no', 'sí', 'quizá', 'nunca'],
  cerrada: false,
  hanRespondido: [],
  tuRespuesta: null,
  puntos: { yo: 100, otra: 40 },
  correcta: null,
  explicacion: null,
  resultados: null,
  turno: null,
  mecha: 0,
  tuTurno: true,
  racha: 0,
  dice: '',
  momento: '',
};

/** Una sala de mentira: la vista la ponemos nosotros. */
function salaFalsa() {
  const vista = signal<TrivialView | null>(BASE);
  return {
    vista,
    error: signal<string | null>(null),
    miAsiento: 'yo',
    nombreDe: (seatId: string) => (seatId === 'yo' ? 'Óscar' : 'Bea'),
    personajeDe: (seatId: string) => (seatId === 'yo' ? 'bolt' : 'viper'),
    reconectar: () => undefined,
    desconectar: () => undefined,
    empezar: () => undefined,
    responder: () => undefined,
    siguiente: () => undefined,
  };
}

describe('la mesa del concurso', () => {
  let fixture: ComponentFixture<TrivialRoom>;
  let sala: ReturnType<typeof salaFalsa>;

  beforeEach(async () => {
    localStorage.clear();
    guardarPase({ roomId: 'sala-1', seatId: 'yo', seatToken: 'pase' });
    sala = salaFalsa();

    await TestBed.configureTestingModule({
      imports: [TrivialRoom],
      providers: [
        provideRouter([]),
        { provide: TrivialRoomService, useValue: sala },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ sala: 'sala-1' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TrivialRoom);
    fixture.detectChanges();
  });

  function pinta(vista: Partial<TrivialView>): string {
    sala.vista.set({ ...BASE, ...vista });
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent;
  }

  function botones(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.opcion'));
  }

  describe('el presentador', () => {
    /** Antes lo generaba cada navegador con su clave: cada uno oía otra cosa. */
    it('dice lo que manda el servidor', () => {
      expect(pinta({ dice: 'Buenas noches, criaturas.' })).toContain('Buenas noches, criaturas.');
    });

    it('y si no dice nada, no se pinta el cartel', () => {
      pinta({ dice: '' });
      expect((fixture.nativeElement as HTMLElement).querySelector('.presentador')).toBeNull();
    });
  });

  describe('el plató', () => {
    /** La cara la manda el servidor con la frase: la mesa ve lo mismo. */
    it('el presentador pone la cara del momento', () => {
      pinta({ momento: 'explota', dice: '¡BOOM!' });
      const host = (fixture.nativeElement as HTMLElement).querySelector('img.host');
      expect(host?.getAttribute('src')).toBe('/assets/trivial/host/wrong.png');
    });

    it('y otra distinta cuando la noticia es buena', () => {
      pinta({ momento: 'aciertaAlguien', dice: '¡Correcto!' });
      const host = (fixture.nativeElement as HTMLElement).querySelector('img.host');
      expect(host?.getAttribute('src')).toBe('/assets/trivial/host/yes.png');
    });

    it('antes de que diga nada, está pero callado', () => {
      pinta({ dice: '', momento: '' });
      const plato = (fixture.nativeElement as HTMLElement).querySelector('.plato');
      expect(plato?.classList.contains('callado')).toBe(true);
      expect((fixture.nativeElement as HTMLElement).querySelector('.bocadillo')).toBeNull();
    });

    it('lo que dice sale en un bocadillo', () => {
      pinta({ dice: 'Buenas noches, criaturas.', momento: 'bienvenida' });
      const bocadillo = (fixture.nativeElement as HTMLElement).querySelector('.bocadillo');
      expect(bocadillo?.textContent).toContain('Buenas noches, criaturas.');
    });
  });

  describe('las caras de la mesa', () => {
    it('el marcador lleva el personaje de cada uno', () => {
      pinta({});
      const caras = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('.clasificacion .avatar'),
      ).map((una) => una.getAttribute('src'));
      expect(caras).toEqual(['/assets/trivial/cast/bolt.png', '/assets/trivial/cast/viper.png']);
    });

    it('y los resultados de la ronda, también', () => {
      pinta({
        cerrada: true,
        explicacion: 'Pues eso.',
        resultados: [{ seatId: 'otra', valor: 1, ganados: 100 }],
      });
      const cara = (fixture.nativeElement as HTMLElement).querySelector('.resultados .avatar');
      expect(cara?.getAttribute('src')).toBe('/assets/trivial/cast/viper.png');
    });

    /** Saber de quién es la bomba de un vistazo, sin leer el nombre. */
    it('con la bomba se ve la cara de quien la tiene', () => {
      pinta({ tipo: 'bomba', turno: 'otra', tuTurno: false, mecha: 3 });
      const cara = (fixture.nativeElement as HTMLElement).querySelector('.bomba .avatar');
      expect(cara?.getAttribute('src')).toBe('/assets/trivial/cast/viper.png');
    });
  });

  describe('las secciones del programa', () => {
    it('cada prueba se presenta con su nombre', () => {
      expect(pinta({ tipo: 'pulsa' })).toContain('El primero que pulse');
      expect(pinta({ tipo: 'rafaga' })).toContain('Ráfaga');
      expect(pinta({ tipo: 'bomba', turno: 'yo' })).toContain('La bomba');
      expect(pinta({ tipo: 'fallo' })).toContain('Encuentra el fallo');
    });
  });

  describe('la bomba', () => {
    it('cuando la tienes tú, lo dice y puedes contestar', () => {
      const texto = pinta({ tipo: 'bomba', turno: 'yo', tuTurno: true, mecha: 3 });
      expect(texto).toContain('La tienes tú');
      expect(botones().every((boton) => !boton.disabled)).toBe(true);
    });

    /** Si los cuatro pudieran pulsar, la bomba no sería de nadie. */
    it('cuando la tiene otro, se mira y no se toca', () => {
      const texto = pinta({ tipo: 'bomba', turno: 'otra', tuTurno: false, mecha: 2 });
      expect(texto).toContain('Bea');
      expect(botones().every((boton) => boton.disabled)).toBe(true);
    });

    it('la mecha se ve, para saber lo que queda', () => {
      pinta({ tipo: 'bomba', turno: 'yo', tuTurno: true, mecha: 4 });
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('.mecha i')).toHaveLength(4);
    });

    it('y con la ronda cerrada ya no se pinta', () => {
      pinta({ tipo: 'bomba', turno: 'yo', mecha: 2, cerrada: true, resultados: [] });
      expect((fixture.nativeElement as HTMLElement).querySelector('.bomba')).toBeNull();
    });
  });

  describe('la ráfaga', () => {
    it('enseña la racha cuando la hay', () => {
      expect(pinta({ tipo: 'rafaga', racha: 3 })).toContain('3');
    });

    it('y no molesta cuando no la hay', () => {
      pinta({ tipo: 'rafaga', racha: 0 });
      expect((fixture.nativeElement as HTMLElement).querySelector('.racha')).toBeNull();
    });
  });

  describe('el resultado de la ronda', () => {
    /** En dos pruebas se resta, y restar tiene que verse que resta. */
    it('lo que se pierde se enseña con su signo', () => {
      const texto = pinta({
        cerrada: true,
        explicacion: 'Pues eso.',
        resultados: [
          { seatId: 'yo', valor: 0, ganados: -50 },
          { seatId: 'otra', valor: 1, ganados: 150 },
        ],
      });
      expect(texto).toContain('-50');
      expect(texto).toContain('+150');
    });
  });

  describe('el marcador', () => {
    it('va ordenado de más a menos', () => {
      pinta({});
      const puestos = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('.clasificacion .nombre'),
      ).map((uno) => uno.textContent);
      expect(puestos).toEqual(['Óscar', 'Bea']);
    });
  });
});
