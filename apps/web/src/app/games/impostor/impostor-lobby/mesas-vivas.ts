import type { RoomInfo } from '@devweb/shared/contracts/rooms';
import type { PaseDeSala } from '../../pase-guardado';

/** Una mesa que este dispositivo puede retomar, con lo que dice el servidor. */
export interface MesaViva {
  readonly pase: PaseDeSala;
  readonly info: RoomInfo;
}

/** Lo que se lee en la ficha, sin tener que abrirla. */
export interface FichaDeMesa {
  readonly nombre: string;
  readonly estado: string;
  readonly gente: string;
  readonly actividad: string;
}

/**
 * Cómo se cuenta la mesa para quien la retoma.
 *
 * Un botón que solo dice «seguir jugando» no sirve: hay que saber si hay
 * alguien dentro y si lleva tres horas muerta.
 */
export function fichaDeMesa(info: RoomInfo, ahora: number): FichaDeMesa {
  const personas = info.seats.filter((asiento) => !asiento.isBot);
  const dentro = personas.filter((asiento) => asiento.connected);
  const bots = info.seats.filter((asiento) => asiento.isBot).length;

  return {
    nombre: info.name,
    estado: estadoDe(info.status),
    gente: genteDe(personas.length, dentro, bots),
    actividad: actividadDe(dentro.length, info.updatedAt, ahora),
  };
}

function estadoDe(status: RoomInfo['status']): string {
  if (status === 'playing') return 'En juego';
  if (status === 'paused') return 'En pausa';
  if (status === 'lobby') return 'Esperando';
  return 'Terminada';
}

function genteDe(
  personas: number,
  dentro: readonly { displayName: string }[],
  bots: number,
): string {
  const maquinas = bots === 0 ? '' : bots === 1 ? ' · 1 bot' : ` · ${bots} bots`;
  if (dentro.length === 0) {
    const cuantas = personas === 1 ? '1 persona' : `${personas} personas`;
    return `Nadie conectado · ${cuantas}${maquinas}`;
  }
  const nombres = dentro.map((uno) => uno.displayName).join(', ');
  const cuantos = dentro.length === 1 ? '1 dentro' : `${dentro.length} dentro`;
  return `${cuantos}: ${nombres}${maquinas}`;
}

function actividadDe(conectados: number, updatedAt: number, ahora: number): string {
  if (conectados > 0) return 'Hay gente activa';
  return `Inactiva ${haceCuanto(updatedAt, ahora)}`;
}

/** Cuánto hace, en una frase corta. */
export function haceCuanto(at: number, ahora: number): string {
  const segundos = Math.max(0, Math.floor((ahora - at) / 1000));
  if (segundos < 45) return 'ahora mismo';
  if (segundos < 90) return 'hace 1 min';
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 5400) return 'hace 1 h';
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`;
  if (segundos < 172800) return 'hace 1 día';
  return `hace ${Math.floor(segundos / 86400)} días`;
}
