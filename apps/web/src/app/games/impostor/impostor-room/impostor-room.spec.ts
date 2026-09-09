import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { ImpostorRoom } from './impostor-room';
import { ImpostorRoomService } from '../impostor-room.service';
import { guardarPase } from '../../pase-guardado';
import type { ChatEntry, SeatInfo } from '@devweb/shared/contracts/rooms';
import type { ImpostorView } from '@devweb/shared/games/impostor/tipos';

/**
 * La pantalla de la mesa.
 *
 * Lo que se comprueba aquí es que pinta lo que manda el servidor y ni una cosa
 * más: si el servidor no manda palabra, en la pantalla no aparece una.
 */

const MESA: SeatInfo[] = [
  { id: 'yo', displayName: 'Óscar', isBot: false, connected: true, isOwner: true, order: 0 },
  { id: 'bea', displayName: 'Bea', isBot: false, connected: true, isOwner: false, order: 1 },
  { id: 'bot', displayName: 'Doge', isBot: true, connected: true, isOwner: false, order: 2 },
];

const BASE: ImpostorView = {
  fase: 'pistas',
  modo: 'clasico',
  tema: 'Comida y bebida',
  tuPalabra: 'Pizza',
  eresImpostor: false,
  orden: ['yo', 'bea', 'bot'],
  listos: ['yo', 'bea', 'bot'],
  vuelta: 1,
  vueltas: 1,
  debateHasta: 0,
  segundosDebate: 90,
  turno: 'yo',
  tuTurno: true,
  pistas: [],
  hanVotado: [],
  tuVoto: null,
  votos: null,
  expulsado: null,
  opciones: [],
  intento: -1,
  tuDisparo: false,
  palabra: null,
  impostores: null,
  desenlace: null,
  marcador: {},
  rondasJugadas: 0,
  dice: '',
  momento: '',
};

/** Una sala de mentira: la vista la ponemos nosotros. */
function salaFalsa() {
  return {
    vista: signal<ImpostorView | null>(BASE),
    error: signal<string | null>(null),
    chat: signal<readonly ChatEntry[]>([]),
    mesa: signal<readonly SeatInfo[]>(MESA),
    conectado: signal(true),
    miAsiento: 'yo',
    nombreDe: (seatId: string) => MESA.find((uno) => uno.id === seatId)?.displayName ?? '',
    esBot: (seatId: string) => seatId === 'bot',
    caraDe: (seatId: string) => (seatId === 'yo' ? 'troll' : 'doge'),
    reconectar: () => undefined,
    desconectar: () => undefined,
    listo: vi.fn(),
    pista: vi.fn(),
    votar: vi.fn(),
    adivinar: vi.fn(),
    alVoto: vi.fn(),
    otraRonda: vi.fn(),
    decir: vi.fn(),
  };
}

describe('la mesa del impostor', () => {
  let fixture: ComponentFixture<ImpostorRoom>;
  let componente: ImpostorRoom;
  let sala: ReturnType<typeof salaFalsa>;

  beforeEach(async () => {
    localStorage.clear();
    guardarPase({ roomId: 'sala-1', seatId: 'yo', seatToken: 'pase' });
    sala = salaFalsa();

    await TestBed.configureTestingModule({
      imports: [ImpostorRoom],
      providers: [
        provideRouter([]),
        { provide: ImpostorRoomService, useValue: sala },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ sala: 'sala-1' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImpostorRoom);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return raiz().textContent;
  }

  it('enseña la palabra que manda el servidor', () => {
    expect(texto()).toContain('Pizza');
  });

  it('al impostor no le enseña ninguna, porque no le mandan ninguna', () => {
    sala.vista.set({ ...BASE, tuPalabra: null, eresImpostor: true });
    fixture.detectChanges();

    expect(texto()).toContain('Eres el impostor');
    expect(texto()).not.toContain('Pizza');
  });

  it('la palabra se puede tapar por si alguien mira de reojo', () => {
    componente.palabraALaVista.set(false);
    fixture.detectChanges();
    expect(texto()).not.toContain('Pizza');
  });

  it('pinta un sitio por asiento, en el orden en que se habla', () => {
    const puestos = componente.mesa();
    expect(puestos).toHaveLength(3);
    expect(puestos.map((uno) => uno.seatId)).toEqual(['yo', 'bea', 'bot']);
  });

  it('las pistas dichas cuelgan de quien las dijo', () => {
    sala.vista.set({
      ...BASE,
      pistas: [{ seatId: 'bea', texto: 'horno', ronda: 0 }],
    });
    fixture.detectChanges();

    const bea = componente.mesa().find((uno) => uno.seatId === 'bea');
    expect(bea?.pistas).toEqual(['horno']);
  });

  it('decir la pista la manda y vacía el campo', () => {
    componente.pista.set('horno');
    componente.decirPista();

    expect(sala.pista).toHaveBeenCalledWith('horno');
    expect(componente.pista()).toBe('');
  });

  it('no se vota mientras se dan pistas', () => {
    componente.votar('bea');
    expect(sala.votar).not.toHaveBeenCalled();
  });

  it('en la votación se vota tocando a alguien, pero nunca a uno mismo', () => {
    sala.vista.set({ ...BASE, fase: 'votacion', turno: null, tuTurno: false });
    fixture.detectChanges();

    componente.votar('yo');
    expect(sala.votar).not.toHaveBeenCalled();

    componente.votar('bea');
    expect(sala.votar).toHaveBeenCalledWith('bea');
  });

  it('entre las pistas y la votación se abre un rato de hablar', () => {
    sala.vista.set({ ...BASE, fase: 'debate', turno: null, tuTurno: false });
    fixture.detectChanges();
    expect(texto()).toContain('Hablad');
  });

  it('la cuenta atrás sale del reloj del servidor', () => {
    const dentroDeUnMinuto = Date.now() + 65_000;
    sala.vista.set({ ...BASE, fase: 'debate', debateHasta: dentroDeUnMinuto });
    fixture.detectChanges();

    expect(componente.debateConReloj).toBe(true);
    expect(componente.quedanSegundos).toBeGreaterThan(60);
    expect(componente.cuentaAtras).toMatch(/^1:0\d$/);
  });

  it('sin reloj no se pinta ninguna cuenta atrás', () => {
    sala.vista.set({ ...BASE, fase: 'debate', debateHasta: 0, segundosDebate: 0 });
    fixture.detectChanges();

    expect(componente.debateConReloj).toBe(false);
    expect(componente.quedanSegundos).toBe(0);
    expect(texto()).toContain('lo diga el anfitrión');
  });

  it('cortar el debate solo se le ofrece al anfitrión', () => {
    sala.vista.set({ ...BASE, fase: 'debate' });
    sala.mesa.set(MESA.map((uno) => ({ ...uno, isOwner: uno.id === 'bea' })));
    fixture.detectChanges();
    expect(texto()).not.toContain('A votar ya');

    sala.mesa.set(MESA);
    fixture.detectChanges();
    expect(texto()).toContain('A votar ya');

    componente.alVoto();
    expect(sala.alVoto).toHaveBeenCalled();
  });

  it('el recuento solo se pinta cuando la votación se cierra', () => {
    sala.vista.set({ ...BASE, fase: 'votacion', votos: null });
    fixture.detectChanges();
    expect(componente.mesa().every((uno) => uno.votos === 0)).toBe(true);

    sala.vista.set({ ...BASE, fase: 'fin', votos: { yo: 'bea', bot: 'bea' } });
    fixture.detectChanges();
    expect(componente.mesa().find((uno) => uno.seatId === 'bea')?.votos).toBe(2);
  });

  it('el disparo final solo se le ofrece a quien le toca', () => {
    sala.vista.set({
      ...BASE,
      fase: 'ultima-palabra',
      tuDisparo: false,
      opciones: ['Pizza', 'Sopa'],
    });
    fixture.detectChanges();
    expect(raiz().querySelectorAll('button.opcion')).toHaveLength(0);

    sala.vista.set({ ...BASE, fase: 'ultima-palabra', tuDisparo: true, opciones: ['Pizza', 'Sopa'] });
    fixture.detectChanges();
    expect(raiz().querySelectorAll('button.opcion')).toHaveLength(2);
  });

  it('al acabar cuenta quién ganó y destapa la palabra', () => {
    sala.vista.set({
      ...BASE,
      fase: 'fin',
      desenlace: 'tripulacion',
      expulsado: 'bea',
      impostores: ['bea'],
      palabra: 'Pizza',
      marcador: { yo: 1, bot: 1 },
    });
    fixture.detectChanges();

    expect(componente.desenlace).toBe('Gana la tripulación');
    expect(componente.ganasteTu).toBe(true);
    expect(texto()).toContain('Pizza');
  });

  it('otra ronda solo la ofrece el anfitrión', () => {
    sala.vista.set({ ...BASE, fase: 'fin', desenlace: 'tripulacion', impostores: ['bea'] });
    fixture.detectChanges();
    expect(componente.anfitrion).toBe(true);

    sala.mesa.set(MESA.map((uno) => ({ ...uno, isOwner: uno.id === 'bea' })));
    fixture.detectChanges();
    expect(componente.anfitrion).toBe(false);
  });

  it('lo que dice la sala se pinta tal cual llega', () => {
    sala.vista.set({ ...BASE, dice: 'Se acabaron las pistas.', momento: 'aVotar' });
    fixture.detectChanges();
    expect(texto()).toContain('Se acabaron las pistas.');
  });

  it('el chat de la mesa se pinta y se manda', () => {
    sala.chat.set([
      { seq: 1, authorId: 'bea', author: 'Bea', kind: 'player', text: 'ha sido el bot', at: 0 },
    ]);
    fixture.detectChanges();
    expect(texto()).toContain('ha sido el bot');

    componente.mensaje.set('que no, que eres tú');
    componente.enviarMensaje();
    expect(sala.decir).toHaveBeenCalledWith('que no, que eres tú');
    expect(componente.mensaje()).toBe('');
  });

  it('mientras no hay conexión se avisa y no se deja jugar', () => {
    sala.conectado.set(false);
    fixture.detectChanges();

    expect(texto()).toContain('Sin conexión');
    expect(componente.puedesHablar).toBe(false);

    componente.votar('bea');
    expect(sala.votar).not.toHaveBeenCalled();
  });

  it('un no del servidor se enseña', () => {
    sala.error.set('No te toca hablar.');
    fixture.detectChanges();
    expect(texto()).toContain('No te toca hablar.');
  });
});
