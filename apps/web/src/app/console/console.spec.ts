import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Console } from './console';

/**
 * La portada es la puerta de entrada al sitio: si una sección no está aquí, no
 * existe para quien llega. Estos tests son la red contra eso, porque la sección
 * de juegos se quedó fuera del menú aunque la ruta funcionara.
 */
describe('Console (la portada)', () => {
  let fixture: ComponentFixture<Console>;
  let component: Console;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Console],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Console);
    component = fixture.componentInstance;
  });

  /** Textos de los enlaces del menú desplegable. */
  function menuLabels(): string[] {
    // El menú se abre ANTES del primer pintado. Abrirlo después choca con la
    // detección automática de Angular en modo zoneless (NG0100).
    component.menuOpen = true;
    fixture.detectChanges();
    return Array.from(
      fixture.nativeElement.querySelectorAll('.menu-dropdown .menu-item') as NodeListOf<HTMLElement>,
    ).map((item) => item.textContent?.trim() ?? '');
  }

  it('el menú ofrece la sección de juegos', () => {
    expect(menuLabels().some((label) => label.includes('juegos'))).toBe(true);
  });

  it('y sigue ofreciendo el resto de secciones', () => {
    const labels = menuLabels().join(' ');
    for (const section of ['scrum-poker', 'dni-generator', 'qr-generator']) {
      expect(labels, section).toContain(section);
    }
  });

  describe('comandos de la terminal', () => {
    function run(command: string) {
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.currentCommand = command;
      component.executeCommand();
      return navigate;
    }

    it('«juegos» lleva a la mesa de juegos', () => {
      expect(run('juegos')).toHaveBeenCalledWith(['/juegos']);
    });

    it('también valen «games» y «risk»', () => {
      expect(run('games')).toHaveBeenCalledWith(['/juegos']);
      expect(run('risk')).toHaveBeenCalledWith(['/juegos']);
    });

    it('no responde a cualquier cosa', () => {
      const navigate = run('cualquiercosa');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('la ayuda menciona los juegos', () => {
      fixture.detectChanges();
      component.currentCommand = 'help';
      component.executeCommand();
      expect(component.terminalOutput.join(' ').toLowerCase()).toContain('juegos');
    });

    it('los proyectos mencionan los juegos', () => {
      fixture.detectChanges();
      component.currentCommand = 'projects';
      component.executeCommand();
      expect(component.terminalOutput.join(' ')).toContain('RISK');
    });
  });
});
