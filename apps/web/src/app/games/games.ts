import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, TerminalLayout],
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
      name: 'Trivial de dev',
      tagline: 'Preguntas que duelen en la retro',
      description:
        'Un concurso con presentador: test, estimaciones y pillar el fallo en un trozo de ' +
        'código. Programación, historia de la informática y cultura de oficina.',
      icon: '🧠',
      players: '2 – 8 jugadores',
      duration: '15 – 30 min',
      route: '/juegos/trivial',
      status: 'listo',
      highlights: [
        'Tres clases de prueba, no solo preguntas',
        'Las respuestas se quedan en el servidor',
        'Presentador con mucha labia y tres rivales de mesa',
      ],
    },
  ];

  constructor(private router: Router) {}

  open(game: GameCard): void {
    if (!game.route) return;
    this.router.navigate([game.route]);
  }
}
