import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Las pieles del sitio. `vaporwave` no se anuncia: se gana con el código
 * Konami de la consola.
 */
export const THEMES = ['dev', 'ai', 'amber', 'ice', 'matrix', 'vaporwave'] as const;
export type Theme = (typeof THEMES)[number];

export const SECRET_THEME: Theme = 'vaporwave';
const THEME_KEY = 'console_theme';

/**
 * El tema no es cosa solo de la consola: lo llevan todas las pantallas.
 *
 * Por eso se cuelga del <html> en vez de guardarse en un componente: los
 * colores viven en variables CSS y cualquier pantalla los hereda sin tener
 * que enterarse de que existe un tema.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private theme: Theme = 'dev';
  readonly change$ = new Subject<Theme>();

  constructor() {
    this.theme = this.read();
    this.paint();
  }

  get current(): Theme {
    return this.theme;
  }

  /** Los que se ofrecen por ahí. El secreto solo si ya lo llevas puesto. */
  listed(): Theme[] {
    return THEMES.filter((t) => t !== SECRET_THEME || this.theme === SECRET_THEME);
  }

  /** Devuelve si el tema existía; los inventados no se aplican. */
  set(theme: Theme): boolean {
    if (!THEMES.includes(theme)) return false;
    this.theme = theme;
    this.paint();
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Navegar en privado no debería costarte el tema.
    }
    this.change$.next(theme);
    return true;
  }

  private paint(): void {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  private read(): Theme {
    try {
      const guardado = localStorage.getItem(THEME_KEY) as Theme;
      return THEMES.includes(guardado) ? guardado : 'dev';
    } catch {
      return 'dev';
    }
  }
}
