import { describe, expect, it } from 'vitest';
import { resumir, scrumModule } from './scrum';
import type { ScrumState, ScrumView } from './scrum';
import type { Seat } from './module';

const ANA: Seat = { id: 'ana', displayName: 'Ana', isBot: false, connected: true };
const LUIS: Seat = { id: 'luis', displayName: 'Luis', isBot: false, connected: true };
const MESA = [ANA, LUIS];

function conVotos(votos: ScrumState['votos'], revelado = false): ScrumState {
  return { asunto: 'La historia', revelado, votos, ronda: 1 };
}

function vista(state: ScrumState, seat: string): ScrumView {
  return scrumModule.view(state, seat, MESA) as ScrumView;
}

describe('el secreto del voto', () => {
  const estado = conVotos({
    ana: { tipo: 'numero', valor: 5 },
    luis: { tipo: 'numero', valor: 13 },
  });

  it('no manda el voto de otro mientras no esté revelado', () => {
    expect(vista(estado, 'ana').votos).toEqual({ ana: { tipo: 'numero', valor: 5 } });
  });

  it('pero sí dice quién ha votado ya, que es lo que hace avanzar la ronda', () => {
    expect(vista(estado, 'ana').hanVotado).toEqual(['ana', 'luis']);
  });

  it('a quien no ha votado no le manda ningún voto', () => {
    const soloLuis = conVotos({ luis: { tipo: 'numero', valor: 13 } });
    expect(vista(soloLuis, 'ana').votos).toEqual({});
  });

  it('al revelar salen todos', () => {
    expect(vista(conVotos(estado.votos, true), 'ana').votos).toEqual(estado.votos);
  });

  it('el resumen solo existe una vez revelado', () => {
    expect(vista(estado, 'ana').resumen).toBeNull();
    expect(vista(conVotos(estado.votos, true), 'ana').resumen).not.toBeNull();
  });
});

describe('reglas', () => {
  it('no se vota una carta que no está en la baraja', () => {
    const error = scrumModule.validate(
      conVotos({}),
      { tipo: 'votar', voto: { tipo: 'numero', valor: 7 } },
      'ana',
      MESA,
    );

    expect(error?.code).toBe('carta-inexistente');
  });

  it('no se vota con la ronda revelada', () => {
    const error = scrumModule.validate(
      conVotos({}, true),
      { tipo: 'votar', voto: { tipo: 'numero', valor: 5 } },
      'ana',
      MESA,
    );

    expect(error?.code).toBe('ronda-revelada');
  });

  it('no se revela una ronda sin votos', () => {
    expect(scrumModule.validate(conVotos({}), { tipo: 'revelar' }, 'ana', MESA)?.code).toBe('sin-votos');
  });

  it('no se revela dos veces', () => {
    const estado = conVotos({ ana: { tipo: 'cafe' } }, true);

    expect(scrumModule.validate(estado, { tipo: 'revelar' }, 'ana', MESA)?.code).toBe('ya-revelada');
  });

  it('votar dos veces cambia el voto, no lo duplica', () => {
    let estado = conVotos({});
    estado = scrumModule.apply(estado, { tipo: 'votar', voto: { tipo: 'numero', valor: 3 } }, 'ana', MESA);
    estado = scrumModule.apply(estado, { tipo: 'votar', voto: { tipo: 'numero', valor: 8 } }, 'ana', MESA);

    expect(estado.votos).toEqual({ ana: { tipo: 'numero', valor: 8 } });
  });

  it('una ronda nueva limpia los votos y cuenta', () => {
    const estado = scrumModule.apply(
      conVotos({ ana: { tipo: 'cafe' } }, true),
      { tipo: 'nueva-ronda', asunto: 'Otra historia' },
      'ana',
      MESA,
    );

    expect(estado).toMatchObject({ asunto: 'Otra historia', revelado: false, votos: {}, ronda: 2 });
  });

  it('quien se va se lleva su voto', () => {
    const estado = scrumModule.onSeatLeave?.(
      conVotos({ ana: { tipo: 'cafe' }, luis: { tipo: 'numero', valor: 5 } }),
      'ana',
    );

    expect(estado?.votos).toEqual({ luis: { tipo: 'numero', valor: 5 } });
  });

  it('aplicar no toca el estado anterior, que es lo que permite rehacer el log', () => {
    const antes = conVotos({});
    scrumModule.apply(antes, { tipo: 'votar', voto: { tipo: 'cafe' } }, 'ana', MESA);

    expect(antes.votos).toEqual({});
  });
});

describe('resumen', () => {
  it('el café y el porro no cuentan como cero', () => {
    const resumen = resumir({
      ana: { tipo: 'numero', valor: 8 },
      luis: { tipo: 'cafe' },
      eva: { tipo: 'porro' },
    });

    expect(resumen).toMatchObject({ media: 8, mediana: 8, cafes: 1, porros: 1 });
  });

  it('sin ningún número no hay media que dar', () => {
    expect(resumir({ ana: { tipo: 'cafe' } })).toMatchObject({ media: null, mediana: null });
  });

  it('detecta el acuerdo, que es cuando la ronda ha terminado', () => {
    const iguales = resumir({ ana: { tipo: 'numero', valor: 5 }, luis: { tipo: 'numero', valor: 5 } });
    const distintos = resumir({ ana: { tipo: 'numero', valor: 5 }, luis: { tipo: 'numero', valor: 8 } });

    expect(iguales.acuerdo).toBe(true);
    expect(distintos.acuerdo).toBe(false);
  });

  it('la mediana con número par de votos es el punto medio', () => {
    const resumen = resumir({
      a: { tipo: 'numero', valor: 1 },
      b: { tipo: 'numero', valor: 2 },
      c: { tipo: 'numero', valor: 3 },
      d: { tipo: 'numero', valor: 8 },
    });

    expect(resumen.mediana).toBe(2.5);
    expect(resumen.media).toBe(3.5);
  });
});
