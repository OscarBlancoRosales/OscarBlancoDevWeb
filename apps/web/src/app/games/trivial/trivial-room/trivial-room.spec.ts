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
  dificultad: null,
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

/** Una sala de mentira: la vista la ponemos nosotros. */
function salaFalsa() {
  const vista = signal<TrivialView | null>(BASE);
  return {
    vista,
    error: signal<string | null>(null),
    miAsiento: 'yo',
    mesa: [
      { id: 'yo', displayName: 'Óscar' },
      { id: 'otra', displayName: 'Bea' },
    ] as unknown as readonly { id: string }[],
    nombreDe: (seatId: string) => (seatId === 'yo' ? 'Óscar' : 'Bea'),
    personajeDe: (seatId: string) => (seatId === 'yo' ? 'bolt' : 'viper'),
    reconectar: () => undefined,
    desconectar: () => undefined,
    empezar: () => undefined,
    responder: () => undefined,
    siguiente: () => undefined,
    apostado: [] as number[],
    impugnado: 0,
    apostar(cuanto: number) {
      this.apostado.push(cuanto);
    },
    impugnar() {
      this.impugnado += 1;
    },
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

    it('y si no dice nada, no se pinta el bocadillo', () => {
      // El presentador sigue en el plató -es parte del decorado-; lo que
      // desaparece es lo que dice.
      pinta({ dice: '' });
      const dom = fixture.nativeElement as HTMLElement;

      expect(dom.querySelector('.presentador')).not.toBeNull();
      expect(dom.querySelector('.bocadillo')).toBeNull();
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
      const dom = fixture.nativeElement as HTMLElement;

      expect(dom.querySelector('.presentador')?.classList.contains('callado')).toBe(true);
      expect(dom.querySelector('.bocadillo')).toBeNull();
    });

    it('lo que dice sale en un bocadillo', () => {
      pinta({ dice: 'Buenas noches, criaturas.', momento: 'bienvenida' });
      const bocadillo = (fixture.nativeElement as HTMLElement).querySelector('.bocadillo');
      expect(bocadillo?.textContent).toContain('Buenas noches, criaturas.');
    });
  });

  describe('las caras de la mesa', () => {
    function carasDeLosAtriles(): (string | null)[] {
      const dom = fixture.nativeElement as HTMLElement;
      return Array.from(dom.querySelectorAll('.atril .cara')).map((una) => una.getAttribute('src'));
    }

    it('cada uno sale en su atril con su personaje', () => {
      pinta({});
      // Ordenados de más a menos puntos: yo llevo 100 y Bea 40.
      expect(carasDeLosAtriles()).toEqual([
        '/assets/trivial/cast/bolt.png',
        '/assets/trivial/cast/viper.png',
      ]);
    });

    it('y lo ganado en la ronda se ve en su atril', () => {
      pinta({
        cerrada: true,
        explicacion: 'Pues eso.',
        resultados: [{ seatId: 'otra', valor: 1, ganados: 100 }],
      });
      const dom = fixture.nativeElement as HTMLElement;
      const suyo = Array.from(dom.querySelectorAll('.atril')).find((atril) =>
        atril.textContent.includes('Bea'),
      );

      expect(suyo?.classList.contains('acierta')).toBe(true);
      expect(suyo?.textContent).toContain('+100');
    });

    /** Saber de quién es la bomba de un vistazo, sin leer el nombre. */
    it('con la bomba, su atril se señala', () => {
      pinta({ tipo: 'bomba', turno: 'otra', tuTurno: false, mecha: 3 });
      const dom = fixture.nativeElement as HTMLElement;
      const suyo = Array.from(dom.querySelectorAll('.atril')).find((atril) =>
        atril.textContent.includes('Bea'),
      );

      expect(suyo?.classList.contains('con-bomba')).toBe(true);
    });

    it('y el que va primero lleva corona', () => {
      pinta({});
      const dom = fixture.nativeElement as HTMLElement;
      expect(dom.querySelectorAll('.atril .corona')).toHaveLength(1);
    });

    it('pero con todos a cero no corona a nadie', () => {
      // Una corona en la ronda uno no dice nada, y se la quedaría quien salga
      // primero en la lista por casualidad.
      pinta({ puntos: { yo: 0, otra: 0 } });
      const dom = fixture.nativeElement as HTMLElement;

      expect(dom.querySelectorAll('.atril .corona')).toHaveLength(0);
    });

    it('la mesa se ve desde antes de que nadie puntúe', () => {
      // El marcador está vacío hasta que alguien acierta. Si los atriles
      // salieran de ahí, la primera ronda no tendría concursantes.
      pinta({ fase: 'ronda', puntos: {} });
      const dom = fixture.nativeElement as HTMLElement;

      expect(dom.querySelectorAll('.atril')).toHaveLength(2);
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
      expect(texto).toContain('La bomba la tienes tú');
      expect(botones().every((boton) => !boton.disabled)).toBe(true);
    });

    /** Si los cuatro pudieran pulsar, la bomba no sería de nadie. */
    it('cuando la tiene otro, se mira y no se toca', () => {
      const texto = pinta({ tipo: 'bomba', turno: 'otra', tuTurno: false, mecha: 2 });
      expect(texto).toContain('Bea');
      expect(botones().every((boton) => boton.disabled)).toBe(true);
    });

    it('la mecha se ve, para saber lo que queda', () => {
      const texto = pinta({ tipo: 'bomba', turno: 'yo', tuTurno: true, mecha: 4 });
      expect(texto).toContain('Mecha: 4');
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
    it('los atriles van ordenados de más a menos', () => {
      pinta({});
      const dom = fixture.nativeElement as HTMLElement;
      const puestos = Array.from(dom.querySelectorAll('.atril .nombre')).map(
        (uno) => uno.textContent,
      );

      expect(puestos).toEqual(['Óscar', 'Bea']);
    });
  });

  describe('qué pieza está en pantalla', () => {
    function hay(selector: string): boolean {
      return !!(fixture.nativeElement as HTMLElement).querySelector(selector);
    }

    it('antes de empezar no hay pregunta, pero la mesa ya se ve', () => {
      // Los atriles son el reparto, no el marcador: verlos antes de arrancar es
      // parte de que esto parezca un plató y no un formulario.
      pinta({ fase: 'presentacion' });

      expect(hay('app-panel-pregunta')).toBe(false);
      expect(hay('.atril')).toBe(true);
    });

    it('en ronda están la pregunta y los atriles', () => {
      pinta({ fase: 'ronda' });

      expect(hay('app-panel-pregunta')).toBe(true);
      expect(hay('.atril')).toBe(true);
    });

    it('con reloj puesto, se ve la cuenta atrás', () => {
      pinta({ fase: 'ronda', cierraEn: Date.now() + 9_000 });
      expect(hay('app-cronometro')).toBe(true);
    });

    it('en apuestas sale el mando y se esconde la pregunta', () => {
      // Ver la pregunta antes de apostar sería apostar sobre seguro.
      pinta({ fase: 'apuestas', tipo: 'final' });

      expect(hay('app-apuesta')).toBe(true);
      expect(hay('app-panel-pregunta')).toBe(false);
    });

    it('al acabar, el podio', () => {
      pinta({ fase: 'fin' });

      expect(hay('app-podio')).toBe(true);
      expect(hay('app-panel-pregunta')).toBe(false);
      expect(hay('.atril')).toBe(false);
    });
  });

  describe('lo que llega al servidor', () => {
    it('la apuesta se manda tal cual', () => {
      pinta({ fase: 'apuestas', tipo: 'final' });
      fixture.componentInstance.apostar(120);

      expect(sala.apostado).toEqual([120]);
    });

    it('e impugnar, también', () => {
      pinta({ fase: 'ronda', inventadas: true });
      const dom = fixture.nativeElement as HTMLElement;
      dom.querySelector<HTMLButtonElement>('.impugnar')?.click();

      expect(sala.impugnado).toBe(1);
    });

    it('y el botón de impugnar no existe en el modo del banco', () => {
      pinta({ fase: 'ronda', inventadas: false });
      expect(hayImpugnar()).toBe(false);
    });
  });

  function hayImpugnar(): boolean {
    return !!(fixture.nativeElement as HTMLElement).querySelector('.impugnar');
  }
});
