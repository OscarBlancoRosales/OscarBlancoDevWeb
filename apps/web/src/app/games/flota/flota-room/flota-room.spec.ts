import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { FlotaRoom } from './flota-room';
import { FlotaRoomService } from '../flota-room.service';
import { guardarPase, olvidarPase } from '../pase-guardado';
import { indice, tableroVacio } from '@devweb/shared/games/flota/reglas';
import type { FlotaView } from '@devweb/shared/games/flota/tipos';

const SALA = 'sala-1';
const MI_ASIENTO = 'asiento-1';

function vistaEnCombate(turno: string): FlotaView {
  return {
    fase: 'combate',
    turno,
    ganador: null,
    desplegados: [MI_ASIENTO, 'bot'],
    tuyo: { barcos: [], recibidos: tableroVacio() },
    rivalId: 'bot',
    disparosSobreRival: tableroVacio(),
    flotaRival: null,
    punteriaTuya: null,
    punteriaRival: null,
  };
}

describe('FlotaRoom', () => {
  let fixture: ComponentFixture<FlotaRoom>;
  let mesa: FlotaRoom;
  let vista: ReturnType<typeof signal<FlotaView | null>>;
  let sala: {
    vista: typeof vista;
    error: ReturnType<typeof signal<string | null>>;
    miAsiento: string;
    mesa: { id: string; displayName: string }[];
    reconectar: ReturnType<typeof vi.fn>;
    desconectar: ReturnType<typeof vi.fn>;
    desplegar: ReturnType<typeof vi.fn>;
    disparar: ReturnType<typeof vi.fn>;
    rendirse: ReturnType<typeof vi.fn>;
  };
  let navigate: ReturnType<typeof vi.fn>;

  function montar(conPase: boolean): void {
    if (conPase) {
      guardarPase({ roomId: SALA, seatId: MI_ASIENTO, seatToken: 'pase-1' });
    } else {
      olvidarPase(SALA);
    }

    vista = signal<FlotaView | null>(null);
    sala = {
      vista,
      error: signal<string | null>(null),
      miAsiento: MI_ASIENTO,
      mesa: [
        { id: MI_ASIENTO, displayName: 'Óscar' },
        { id: 'bot', displayName: 'Almirante' },
      ],
      reconectar: vi.fn(),
      desconectar: vi.fn(),
      desplegar: vi.fn(),
      disparar: vi.fn(),
      rendirse: vi.fn(),
    };
    navigate = vi.fn(() => Promise.resolve(true));

    TestBed.configureTestingModule({
      imports: [FlotaRoom],
      providers: [
        { provide: FlotaRoomService, useValue: sala },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ sala: SALA }) } },
        },
      ],
    });

    fixture = TestBed.createComponent(FlotaRoom);
    mesa = fixture.componentInstance;
    mesa.ngOnInit();
  }

  afterEach(() => {
    olvidarPase(SALA);
    TestBed.resetTestingModule();
  });

  describe('entrar', () => {
    it('con pase guardado se reconecta a la sala', () => {
      montar(true);
      expect(sala.reconectar).toHaveBeenCalledWith({
        roomId: SALA,
        seatId: MI_ASIENTO,
        seatToken: 'pase-1',
      });
    });

    it('sin pase vuelve al lobby en vez de enseñar una mesa muerta', () => {
      montar(false);
      expect(sala.reconectar).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/juegos/flota'], { queryParams: { sala: SALA } });
    });

    it('salir de la pantalla cierra la conexion', () => {
      montar(true);
      mesa.ngOnDestroy();
      expect(sala.desconectar).toHaveBeenCalled();
    });
  });

  describe('colocar la flota', () => {
    beforeEach(() => {
      montar(true);
    });

    it('empieza por el barco de cinco', () => {
      expect(mesa.tamanoPendiente).toBe(5);
      expect(mesa.flotaCompleta).toBe(false);
    });

    it('girar cambia la orientacion del siguiente', () => {
      mesa.girarBarco();
      expect(mesa.orientacion).toBe('vertical');
    });

    it('al azar deja la flota lista de una vez', () => {
      mesa.alAzar();
      expect(mesa.flotaCompleta).toBe(true);
    });

    it('no manda una flota a medias', () => {
      mesa.colocarEn({ fila: 0, columna: 0 });
      mesa.desplegar();
      expect(sala.desplegar).not.toHaveBeenCalled();
    });

    it('manda la flota entera cuando esta completa', () => {
      mesa.alAzar();
      mesa.desplegar();
      expect(sala.desplegar).toHaveBeenCalledTimes(1);
      expect(sala.desplegar.mock.calls[0]?.[0]).toHaveLength(5);
    });
  });

  describe('combatir', () => {
    beforeEach(() => {
      montar(true);
    });

    it('es tu turno cuando el servidor lo dice', () => {
      vista.set(vistaEnCombate(MI_ASIENTO));
      expect(mesa.esMiTurno).toBe(true);

      vista.set(vistaEnCombate('bot'));
      expect(mesa.esMiTurno).toBe(false);
    });

    it('el disparo va al servidor con su casilla', () => {
      vista.set(vistaEnCombate(MI_ASIENTO));
      mesa.disparar({ fila: 6, columna: 2 });
      expect(sala.disparar).toHaveBeenCalledWith(6, 2);
    });

    it('el nombre del rival sale de la mesa, no del identificador', () => {
      vista.set(vistaEnCombate(MI_ASIENTO));
      expect(mesa.nombreDelRival).toBe('Almirante');
    });

    it('el tablero del rival es lo que le has disparado', () => {
      const enCombate = vistaEnCombate(MI_ASIENTO);
      const disparos = [...enCombate.disparosSobreRival];
      disparos[indice(3, 3)] = 'hundido';
      vista.set({ ...enCombate, disparosSobreRival: disparos });

      expect(mesa.tableroRival[indice(3, 3)]).toBe('hundido');
    });
  });

  describe('terminar', () => {
    beforeEach(() => {
      montar(true);
    });

    it('sabe si has ganado', () => {
      vista.set({ ...vistaEnCombate(MI_ASIENTO), fase: 'fin', ganador: MI_ASIENTO, turno: null });
      expect(mesa.heGanado).toBe(true);
    });

    it('y si has perdido', () => {
      vista.set({ ...vistaEnCombate(MI_ASIENTO), fase: 'fin', ganador: 'bot', turno: null });
      expect(mesa.heGanado).toBe(false);
    });
  });
});
