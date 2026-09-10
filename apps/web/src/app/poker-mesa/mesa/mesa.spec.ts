import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { signal } from '@angular/core';
import { MesaPoker, guardarPaseDeMesa } from './mesa';
import { MesaService } from '../mesa.service';
import type { SeatInfo } from '@devweb/shared/contracts/rooms';
import type { ScrumView, ScrumVote } from '@devweb/shared/games/scrum';

/**
 * La mesa de planning poker.
 *
 * Es el mismo juego que la versión clásica, así que lo que hay que comprobar
 * aquí es lo que la mesa añade: que las cartas de los demás siguen tapadas
 * hasta que se destapan, que se ve quién se ha salido del corro y que el
 * crupier pone la cara de lo que está diciendo.
 */

const ASIENTOS: SeatInfo[] = [
  { id: 'yo', displayName: 'Óscar', isBot: false, connected: true, isOwner: true, order: 0, meta: { avatar: 'turing' } },
  { id: 'bea', displayName: 'Bea', isBot: false, connected: true, isOwner: false, order: 1, meta: { avatar: 'hopper' } },
  { id: 'eva', displayName: 'Eva', isBot: false, connected: true, isOwner: false, order: 2, meta: { avatar: 'linus' } },
];

const BASE: ScrumView = {
  asunto: 'migrar el login',
  revelado: false,
  ronda: 1,
  hanVotado: [],
  votos: {},
  resumen: null,
  dice: '',
  momento: '',
};

/** Una sala de mentira: la vista y la mesa las ponemos nosotros. */
function salaFalsa() {
  const vista = signal<ScrumView | null>(BASE);
  const mesa = signal<readonly SeatInfo[]>(ASIENTOS);
  const bocadillos = signal<Record<string, { texto: string }>>({});

  return {
    vista,
    mesa,
    bocadillos: () => bocadillos(),
    ponerBocadillo: (seatId: string, texto: string) => {
      bocadillos.set({ [seatId]: { texto } });
    },
    error: signal<string | null>(null),
    chat: signal<readonly { kind: string; authorId: string; author: string; text: string }[]>([]),
    miAsiento: 'yo',
    nombreDe: (seatId: string) => ASIENTOS.find((uno) => uno.id === seatId)?.displayName ?? '',
    avatarDe: (seatId: string) =>
      ({ yo: 'turing', bea: 'hopper', eva: 'linus' })[seatId] ?? 'anon',
    reconectar: () => undefined,
    desconectar: () => undefined,
    votar: (_voto: ScrumVote) => undefined,
    retirarVoto: () => undefined,
    revelar: () => undefined,
    nuevaRonda: () => undefined,
    decir: () => undefined,
  };
}

describe('la mesa de poker', () => {
  let fixture: ComponentFixture<MesaPoker>;
  let sala: ReturnType<typeof salaFalsa>;

  beforeEach(async () => {
    localStorage.clear();
    guardarPaseDeMesa({ roomId: 'sala-1', seatId: 'yo', seatToken: 'pase' });
    sala = salaFalsa();

    await TestBed.configureTestingModule({
      imports: [MesaPoker],
      providers: [
        provideRouter([]),
        { provide: MesaService, useValue: sala },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ sala: 'sala-1' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MesaPoker);
    fixture.detectChanges();
  });

  function pinta(vista: Partial<ScrumView>): string {
    sala.vista.set({ ...BASE, ...vista });
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent;
  }

  function dom(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** La ficha de ese valor, tal y como la pulsaría alguien. */
  function ficha(valor: string): HTMLButtonElement {
    const encontrada = Array.from(dom().querySelectorAll('.ficha')).find(
      (una) => una.textContent.trim() === valor,
    );
    if (!encontrada) throw new Error(`no hay ficha de ${valor}`);
    return encontrada as HTMLButtonElement;
  }

  describe('quién está sentado', () => {
    it('hay un sitio por persona', () => {
      pinta({});
      expect(dom().querySelectorAll('.sitio')).toHaveLength(3);
    });

    it('cada uno con la cara que eligió', () => {
      pinta({});
      const caras = Array.from(dom().querySelectorAll('.sitio .avatar')).map((una) =>
        una.getAttribute('src'),
      );
      expect(caras).toEqual([
        '/assets/poker/legends/turing.png',
        '/assets/poker/legends/hopper.png',
        '/assets/poker/legends/linus.png',
      ]);
    });

    it('y se ve quién ha votado ya', () => {
      pinta({ hanVotado: ['bea'] });
      const votados = dom().querySelectorAll('.sitio.ha-votado');
      expect(votados).toHaveLength(1);
    });
  });

  describe('las cartas', () => {
    /**
     * Si se vieran antes de destapar, esto no sería planning poker.
     *
     * Se miran las cartas del tapete y no la página entera: los mismos
     * números están en tu baraja, que es de donde eliges.
     */
    it('las de los demás están boca abajo hasta que se destapan', () => {
      pinta({ hanVotado: ['yo', 'bea'], votos: { yo: { tipo: 'numero', valor: 5 } } });

      const enElTapete = Array.from(dom().querySelectorAll('.sitio .carta')).map((carta) => ({
        dice: carta.textContent.trim(),
        tapada: carta.classList.contains('tapada'),
        vacia: carta.classList.contains('vacia'),
      }));

      // La tuya, el dorso de quien ya votó y el hueco de quien falta. El dorso
      // no enseña ni un número: es un patrón, no una interrogación.
      expect(enElTapete).toEqual([
        { dice: '5', tapada: false, vacia: false },
        { dice: '', tapada: true, vacia: false },
        { dice: '', tapada: true, vacia: true },
      ]);
    });

    it('la tuya la ves siempre, que es la que has echado', () => {
      const texto = pinta({
        hanVotado: ['yo'],
        votos: { yo: { tipo: 'numero', valor: 8 } },
      });
      expect(texto).toContain('8');
    });

    it('al destapar se ven todas', () => {
      const texto = pinta({
        revelado: true,
        hanVotado: ['yo', 'bea', 'eva'],
        votos: {
          yo: { tipo: 'numero', valor: 5 },
          bea: { tipo: 'numero', valor: 3 },
          eva: { tipo: 'numero', valor: 21 },
        },
      });
      expect(texto).toContain('21');
      expect(dom().querySelectorAll('.carta.tapada')).toHaveLength(0);
    });

    it('el café y el porro se ven con su carta', () => {
      const texto = pinta({
        revelado: true,
        hanVotado: ['yo', 'bea'],
        votos: { yo: { tipo: 'cafe' }, bea: { tipo: 'porro' } },
      });
      expect(texto).toContain('☕');
      expect(texto).toContain('🚬');
    });
  });

  describe('los desvíos', () => {
    /** Es lo que hace útil el planning poker: ver quién no ve lo mismo. */
    it('quien se sale del corro se marca', () => {
      pinta({
        revelado: true,
        hanVotado: ['yo', 'bea', 'eva'],
        votos: {
          yo: { tipo: 'numero', valor: 3 },
          bea: { tipo: 'numero', valor: 3 },
          eva: { tipo: 'numero', valor: 21 },
        },
      });
      expect(dom().querySelectorAll('.carta.leve, .carta.grave').length).toBeGreaterThan(0);
    });

    it('con la mesa de acuerdo no se marca a nadie', () => {
      pinta({
        revelado: true,
        hanVotado: ['yo', 'bea', 'eva'],
        votos: {
          yo: { tipo: 'numero', valor: 5 },
          bea: { tipo: 'numero', valor: 5 },
          eva: { tipo: 'numero', valor: 5 },
        },
      });
      expect(dom().querySelectorAll('.carta.leve, .carta.grave')).toHaveLength(0);
    });

    it('y se enseñan las cuentas de la ronda', () => {
      const texto = pinta({
        revelado: true,
        hanVotado: ['yo', 'bea'],
        votos: { yo: { tipo: 'numero', valor: 3 }, bea: { tipo: 'numero', valor: 13 } },
      });
      expect(texto).toContain('media');
      expect(texto).toContain('8');
    });

    it('cuando la mesa se parte en dos, se avisa', () => {
      const texto = pinta({
        revelado: true,
        hanVotado: ['yo', 'bea', 'eva', 'luis'],
        votos: {
          yo: { tipo: 'numero', valor: 1 },
          bea: { tipo: 'numero', valor: 1 },
          eva: { tipo: 'numero', valor: 13 },
          luis: { tipo: 'numero', valor: 13 },
        },
      });
      expect(texto).toContain('partida');
    });
  });

  describe('el crupier', () => {
    it('pone la cara de lo que está diciendo', () => {
      pinta({ dice: 'Explícate, anda', momento: 'elDesviado' });
      expect(dom().querySelector('.dealer')?.getAttribute('src')).toBe(
        '/assets/poker/dealer/sarcastic.png',
      );
    });

    it('y otra cuando mete prisa', () => {
      pinta({ dice: 'Espabilad', momento: 'espabila' });
      expect(dom().querySelector('.dealer')?.getAttribute('src')).toBe(
        '/assets/poker/dealer/angry.png',
      );
    });

    it('lo que dice sale en su bocadillo', () => {
      pinta({ dice: 'Cartas en la mesa.', momento: 'reparte' });
      expect(dom().querySelector('.dice')?.textContent).toContain('Cartas en la mesa.');
    });

    it('y si no ha dicho nada, está pero callado', () => {
      pinta({ dice: '' });
      expect(dom().querySelector('.crupier')?.classList.contains('callado')).toBe(true);
      expect(dom().querySelector('.dice')).toBeNull();
    });
  });

  describe('los bocadillos de la charla', () => {
    it('salen encima de quien habla', () => {
      sala.ponerBocadillo('bea', 'Yo lo veo chico');
      const texto = pinta({});
      expect(texto).toContain('Yo lo veo chico');
      expect(dom().querySelectorAll('.bocadillo')).toHaveLength(1);
    });

    /** Un mensaje de hace diez minutos encima de la cabeza es un cartel. */
    it('y cuando no hay nada reciente, no se pinta ninguno', () => {
      pinta({});
      expect(dom().querySelectorAll('.bocadillo')).toHaveLength(0);
    });
  });

  describe('votar con fichas', () => {
    it('las fichas están mientras no se destape', () => {
      pinta({});
      expect(dom().querySelectorAll('.ficha').length).toBeGreaterThan(4);
    });

    it('y desaparecen al destapar, que ya no se vota', () => {
      pinta({ revelado: true, hanVotado: ['yo'], votos: { yo: { tipo: 'numero', valor: 5 } } });
      expect(dom().querySelectorAll('.ficha')).toHaveLength(0);
    });

    /**
     * Se apilan, no se sustituyen: un siete es cinco y dos. Con una escala
     * cerrada habría que redondear a lo que hubiera en la baraja.
     */
    it('cada ficha se suma a lo que ya llevas', () => {
      const echados: number[] = [];
      sala.votar = (voto: ScrumVote) => {
        if (voto.tipo === 'numero') echados.push(voto.valor);
      };

      pinta({});
      ficha('5').click();
      pinta({ hanVotado: ['yo'], votos: { yo: { tipo: 'numero', valor: 5 } } });
      ficha('2').click();

      expect(echados).toEqual([5, 7]);
    });

    it('lo apostado se ve, y se puede retirar', () => {
      const texto = pinta({ hanVotado: ['yo'], votos: { yo: { tipo: 'numero', valor: 13 } } });
      expect(dom().querySelector('.monton-valor')?.textContent.trim()).toBe('13');
      expect(texto).toContain('Retirar');
    });

    it('sin votar todavía, el montón está a cero y no ofrece retirar', () => {
      const texto = pinta({});
      expect(dom().querySelector('.monton-valor')?.textContent.trim()).toBe('0');
      expect(texto).not.toContain('Retirar');
    });

    it('se dice cuántos faltan por votar', () => {
      expect(pinta({ hanVotado: ['yo'] })).toContain('Faltan 2');
    });
  });

  describe('cómo ha votado la mesa', () => {
    /**
     * Una media de ocho puede ser todos en ocho o media mesa en tres y media
     * en trece, y esas dos reuniones no se parecen en nada.
     */
    it('se enseña el reparto de votos al destapar', () => {
      pinta({
        revelado: true,
        hanVotado: ['yo', 'bea', 'eva'],
        votos: {
          yo: { tipo: 'numero', valor: 5 },
          bea: { tipo: 'numero', valor: 5 },
          eva: { tipo: 'numero', valor: 13 },
        },
      });

      const filas = Array.from(dom().querySelectorAll('.reparto .fila')).map((fila) => [
        fila.querySelector('.valor')?.textContent.trim(),
        fila.querySelector('.cuantos')?.textContent.trim(),
      ]);
      expect(filas).toEqual([
        ['5', '2'],
        ['13', '1'],
      ]);
    });

    /** Medir contra el más votado pinta todas las barras llenas y engaña. */
    it('las barras van sobre el total de la mesa, no sobre el más votado', () => {
      pinta({
        revelado: true,
        hanVotado: ['yo', 'bea'],
        votos: { yo: { tipo: 'numero', valor: 3 }, bea: { tipo: 'numero', valor: 8 } },
      });
      const anchos = Array.from(dom().querySelectorAll<HTMLElement>('.reparto .barra i')).map(
        (barra) => barra.style.width,
      );
      expect(anchos).toEqual(['50%', '50%']);
    });

    it('sin destapar no se enseña nada', () => {
      pinta({ hanVotado: ['yo'] });
      expect(dom().querySelector('.reparto')).toBeNull();
    });
  });
});
