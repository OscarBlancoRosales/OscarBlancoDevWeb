import { describe, expect, it } from 'vitest';
import { flotaModule } from './index';
import { indice } from './reglas';
import type { Barco, FlotaState, FlotaView } from './tipos';
import type { Seat } from '../module';

const SEATS: Seat[] = [
  { id: 'ana', displayName: 'Ana', isBot: false, connected: true, order: 0 },
  { id: 'bea', displayName: 'Bea', isBot: false, connected: true, order: 1 },
];

/** La flota de Ana ocupa las cinco primeras filas. */
const FLOTA_ANA: Barco[] = [
  { fila: 0, columna: 0, tamano: 5, orientacion: 'horizontal' },
  { fila: 1, columna: 0, tamano: 4, orientacion: 'horizontal' },
  { fila: 2, columna: 0, tamano: 3, orientacion: 'horizontal' },
  { fila: 3, columna: 0, tamano: 3, orientacion: 'horizontal' },
  { fila: 4, columna: 0, tamano: 2, orientacion: 'horizontal' },
];

/** La de Bea, las cinco últimas: ninguna coordenada coincide con las de Ana. */
const FLOTA_BEA: Barco[] = FLOTA_ANA.map((barco) => ({ ...barco, fila: barco.fila + 5 }));

function conLasDosFlotasPuestas(): FlotaState {
  const inicial = flotaModule.createState(SEATS, { semilla: 7 });
  const una = flotaModule.apply(inicial, { tipo: 'desplegar', barcos: FLOTA_ANA }, 'ana', SEATS);
  return flotaModule.apply(una, { tipo: 'desplegar', barcos: FLOTA_BEA }, 'bea', SEATS);
}

function vistaDe(state: FlotaState, seat: string): FlotaView {
  return flotaModule.view(state, seat, SEATS) as FlotaView;
}

describe('colocacion', () => {
  it('empieza sin bandos, sin turno y en colocacion', () => {
    const state = flotaModule.createState(SEATS, {});
    expect(state.fase).toBe('colocacion');
    expect(state.turno).toBeNull();
    expect(state.orden).toEqual([]);
  });

  it('pasa a combate cuando las dos flotas estan puestas', () => {
    const state = conLasDosFlotasPuestas();
    expect(state.fase).toBe('combate');
    expect(state.turno).toBe('ana');
  });

  it('abre fuego quien desplego primero', () => {
    const inicial = flotaModule.createState(SEATS, {});
    const una = flotaModule.apply(inicial, { tipo: 'desplegar', barcos: FLOTA_BEA }, 'bea', SEATS);
    const dos = flotaModule.apply(una, { tipo: 'desplegar', barcos: FLOTA_ANA }, 'ana', SEATS);
    expect(dos.turno).toBe('bea');
  });

  it('no deja desplegar dos veces', () => {
    const una = flotaModule.apply(
      flotaModule.createState(SEATS, {}),
      { tipo: 'desplegar', barcos: FLOTA_ANA },
      'ana',
      SEATS,
    );
    expect(
      flotaModule.validate(una, { tipo: 'desplegar', barcos: FLOTA_ANA }, 'ana', SEATS)?.code,
    ).toBe('ya-desplegada');
  });

  it('no deja sentarse a un tercero cuando la mesa esta hecha', () => {
    const state = conLasDosFlotasPuestas();
    expect(
      flotaModule.validate(state, { tipo: 'desplegar', barcos: FLOTA_ANA }, 'cris', SEATS)?.code,
    ).toBe('ya-no-se-coloca');
  });

  it('rechaza una flota ilegal con el motivo de las reglas', () => {
    const inicial = flotaModule.createState(SEATS, {});
    const solapada = [...FLOTA_ANA];
    solapada[1] = { fila: 0, columna: 0, tamano: 4, orientacion: 'horizontal' };
    expect(
      flotaModule.validate(inicial, { tipo: 'desplegar', barcos: solapada }, 'ana', SEATS)?.code,
    ).toBe('barcos-solapados');
  });

  it('no deja disparar mientras se coloca', () => {
    const inicial = flotaModule.createState(SEATS, {});
    expect(
      flotaModule.validate(inicial, { tipo: 'disparar', fila: 0, columna: 0 }, 'ana', SEATS)?.code,
    ).toBe('aun-no-se-dispara');
  });
});

describe('turnos', () => {
  it('acertar da otro disparo', () => {
    const state = conLasDosFlotasPuestas();
    const tras = flotaModule.apply(state, { tipo: 'disparar', fila: 5, columna: 0 }, 'ana', SEATS);
    expect(tras.turno).toBe('ana');
  });

  it('fallar cede el turno', () => {
    const state = conLasDosFlotasPuestas();
    const tras = flotaModule.apply(state, { tipo: 'disparar', fila: 9, columna: 9 }, 'ana', SEATS);
    expect(tras.turno).toBe('bea');
  });

  it('no se dispara fuera de turno', () => {
    const state = conLasDosFlotasPuestas();
    expect(
      flotaModule.validate(state, { tipo: 'disparar', fila: 0, columna: 0 }, 'bea', SEATS)?.code,
    ).toBe('no-es-tu-turno');
  });

  it('no se dispara dos veces a la misma casilla', () => {
    const state = conLasDosFlotasPuestas();
    const tras = flotaModule.apply(state, { tipo: 'disparar', fila: 5, columna: 0 }, 'ana', SEATS);
    expect(
      flotaModule.validate(tras, { tipo: 'disparar', fila: 5, columna: 0 }, 'ana', SEATS)?.code,
    ).toBe('ya-disparado');
  });

  it('quien mira la partida no dispara', () => {
    const state = conLasDosFlotasPuestas();
    expect(
      flotaModule.validate(state, { tipo: 'disparar', fila: 0, columna: 0 }, 'cris', SEATS)?.code,
    ).toBe('no-es-tu-turno');
  });
});

describe('final', () => {
  it('gana quien hunde la flota entera', () => {
    let state = conLasDosFlotasPuestas();
    for (const barco of FLOTA_BEA) {
      for (let paso = 0; paso < barco.tamano; paso++) {
        state = flotaModule.apply(
          state,
          { tipo: 'disparar', fila: barco.fila, columna: barco.columna + paso },
          'ana',
          SEATS,
        );
      }
    }
    expect(state.fase).toBe('fin');
    expect(state.ganador).toBe('ana');
    expect(state.turno).toBeNull();
  });

  it('rendirse da la partida al otro', () => {
    const state = flotaModule.apply(conLasDosFlotasPuestas(), { tipo: 'rendirse' }, 'ana', SEATS);
    expect(state.fase).toBe('fin');
    expect(state.ganador).toBe('bea');
  });

  it('en una partida terminada ya no se dispara', () => {
    const state = flotaModule.apply(conLasDosFlotasPuestas(), { tipo: 'rendirse' }, 'ana', SEATS);
    expect(
      flotaModule.validate(state, { tipo: 'disparar', fila: 5, columna: 0 }, 'bea', SEATS)?.code,
    ).toBe('partida-terminada');
  });

  it('no se rinde quien no esta jugando', () => {
    const state = conLasDosFlotasPuestas();
    expect(flotaModule.validate(state, { tipo: 'rendirse' }, 'cris', SEATS)?.code).toBe('no-juegas');
  });
});

describe('lo que ve cada asiento', () => {
  it('los barcos a flote del rival no salen del servidor', () => {
    const vista = vistaDe(conLasDosFlotasPuestas(), 'ana');
    const serializada = JSON.stringify(vista);

    expect(vista.flotaRival).toBeNull();
    // La flota de Bea vive de la fila 5 para abajo, y la de Ana de la 4 para
    // arriba: si alguna de esas filas aparece, es que ha viajado un barco ajeno.
    for (const fila of [5, 6, 7, 8, 9]) {
      expect(serializada).not.toContain(`"fila":${fila}`);
    }
    expect(vista.tuyo?.barcos).toHaveLength(FLOTA_ANA.length);
  });

  it('cada uno ve sus disparos sobre el rival', () => {
    const state = flotaModule.apply(
      conLasDosFlotasPuestas(),
      { tipo: 'disparar', fila: 5, columna: 0 },
      'ana',
      SEATS,
    );
    const vista = vistaDe(state, 'ana');
    expect(vista.disparosSobreRival[indice(5, 0)]).toBe('tocado');
    expect(vista.disparosSobreRival[indice(9, 9)]).toBeNull();
    expect(vista.rivalId).toBe('bea');
  });

  it('quien recibe el disparo lo ve en su propio tablero', () => {
    const state = flotaModule.apply(
      conLasDosFlotasPuestas(),
      { tipo: 'disparar', fila: 5, columna: 0 },
      'ana',
      SEATS,
    );
    expect(vistaDe(state, 'bea').tuyo?.recibidos[indice(5, 0)]).toBe('tocado');
  });

  it('al terminar se abren las dos flotas y la punteria', () => {
    const state = flotaModule.apply(conLasDosFlotasPuestas(), { tipo: 'rendirse' }, 'bea', SEATS);
    const vista = vistaDe(state, 'ana');
    expect(vista.flotaRival).toHaveLength(FLOTA_BEA.length);
    expect(vista.punteriaTuya).toEqual({ disparos: 0, aciertos: 0, porcentaje: 0 });
    expect(vista.punteriaRival).not.toBeNull();
  });

  it('quien mira la partida no ve ninguna de las dos flotas', () => {
    const vista = vistaDe(conLasDosFlotasPuestas(), 'cris');
    expect(vista.tuyo).toBeNull();
    expect(vista.flotaRival).toBeNull();
    expect(JSON.stringify(vista)).not.toContain('"tamano"');
  });

  it('cuenta quien ha desplegado ya', () => {
    const una = flotaModule.apply(
      flotaModule.createState(SEATS, {}),
      { tipo: 'desplegar', barcos: FLOTA_ANA },
      'ana',
      SEATS,
    );
    expect(vistaDe(una, 'bea').desplegados).toEqual(['ana']);
  });
});

describe('irse de la mesa', () => {
  it('no es rendirse: la flota sigue donde estaba', () => {
    const state = conLasDosFlotasPuestas();
    const tras = flotaModule.onSeatLeave?.(state, 'ana') ?? state;
    expect(tras.fase).toBe('combate');
    expect(tras.bandos['ana']).toBeDefined();
  });
});

describe('lo que hace un asiento sin nadie detras', () => {
  it('despliega una flota legal en cuanto empieza', () => {
    const state = flotaModule.createState(SEATS, { semilla: 4 });
    const jugada = flotaModule.botAction?.(state, 'bot', SEATS);
    expect(jugada?.tipo).toBe('desplegar');
    expect(jugada && flotaModule.validate(state, jugada, 'bot', SEATS)).toBeNull();
  });

  it('no despliega dos veces', () => {
    const una = flotaModule.apply(
      flotaModule.createState(SEATS, {}),
      { tipo: 'desplegar', barcos: FLOTA_ANA },
      'bot',
      SEATS,
    );
    expect(flotaModule.botAction?.(una, 'bot', SEATS)).toBeNull();
  });

  it('no juega si no es su turno', () => {
    expect(flotaModule.botAction?.(conLasDosFlotasPuestas(), 'bea', SEATS)).toBeNull();
  });

  it('dispara a una casilla legal cuando le toca', () => {
    const state = conLasDosFlotasPuestas();
    const jugada = flotaModule.botAction?.(state, 'ana', SEATS);
    expect(jugada?.tipo).toBe('disparar');
    expect(jugada && flotaModule.validate(state, jugada, 'ana', SEATS)).toBeNull();
  });

  it('dos bots terminan la partida solos, y siempre la misma', () => {
    const partida = (): FlotaState => {
      let state = flotaModule.createState(SEATS, { semilla: 11, nivelBot: 'almirante' });
      // Doscientas casillas por bando dan de sobra para hundir dos flotas; si
      // hicieran falta más, es que el bot está repitiendo disparos.
      for (let jugada = 0; jugada < 400 && state.fase !== 'fin'; jugada++) {
        for (const seat of ['ana', 'bea']) {
          const accion = flotaModule.botAction?.(state, seat, SEATS);
          if (accion) state = flotaModule.apply(state, accion, seat, SEATS);
        }
      }
      return state;
    };

    const una = partida();
    expect(una.fase).toBe('fin');
    expect(una.ganador).not.toBeNull();
    expect(JSON.stringify(partida())).toBe(JSON.stringify(una));
  });
});
