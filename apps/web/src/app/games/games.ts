import { Component } from '@angular/core';

import { Router } from '@angular/router';
import { TerminalLayout } from '../shared/terminal-layout/terminal-layout';
import { RISK_MAPS } from '@devweb/shared/engine/maps/map-registry';

interface GameCard {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  players: string;
  duration: string;
  route: string | null;
  status: 'listo' | 'en-obras';
  highlights: string[];
}

/**
 * Portada de la sección de juegos.
 * Mismo lenguaje visual que el Scrum Poker: terminal oscura, verde fósforo y
 * tarjetas con borde vivo.
 */
@Component({
  selector: 'app-games',
  imports: [TerminalLayout],
  templateUrl: './games.html',
  styleUrl: './games.css',
})
export class Games {
  readonly games: GameCard[] = [
    {
      id: 'risk',
      name: 'RISK',
      tagline: 'Conquista por turnos, dados y traiciones',
      description:
        'El clásico de siempre, con reglas completas: refuerzos, canje de cartas, ataques con dados, reagrupación y bonificación por continente.',
      icon: '🌍',
      players: '2 – 6 jugadores',
      duration: '30 – 90 min',
      route: '/juegos/risk',
      status: 'listo',
      highlights: [
        `${RISK_MAPS.length} mapas jugables`,
        'Bots con IA y chat en cada turno',
        'Partidas grabadas y reanudables',
      ],
    },
    {
      id: 'hundir-la-flota',
      name: 'Hundir la flota',
      tagline: 'Coordenadas, faroles y mucha paciencia',
      description:
        'Tableros ocultos, disparos por turnos y estadísticas de puntería al final. Los barcos ' +
        'que siguen a flote no viajan al navegador de nadie: los guarda el servidor.',
      icon: '🚢',
      players: '2 jugadores',
      duration: '10 – 20 min',
      route: '/juegos/flota',
      status: 'listo',
      highlights: [
        'Tres bots: grumete, marino y almirante',
        'El tablero del rival no sale del servidor',
        'Puntería de los dos al terminar',
      ],
    },
    {
      id: 'trivial',
      name: 'El Concurso',
      tagline: 'Un programa de tele para programadores',
      description:
        'Seis secciones con presentador: test, el primero que pulse, ráfaga de verdadero o ' +
        'falso, pillar el fallo, estimación a ojo y la bomba, que va pasando de mano en mano.',
      icon: '🧠',
      players: '2 – 8 jugadores',
      duration: '15 – 30 min',
      route: '/juegos/trivial',
      status: 'listo',
      highlights: [
        'Seis secciones con mecánica propia, no solo preguntas',
        'La bomba va pasando y estalla en manos de quien la tenga',
        'Las respuestas se quedan en el servidor',
        'Presentador que se entera de todo y lo canta',
      ],
    },
  ];

  constructor(private router: Router) {}

  open(game: GameCard): void {
    if (!game.route) return;
    void this.router.navigate([game.route]);
  }
}
