import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommandPalette } from './command-palette';

/**
 * La paleta es la misma caja en la portada y en las herramientas, así que sus
 * reglas se prueban una vez, aquí, y no en cada pantalla que la use.
 */
describe('la paleta de comandos', () => {
  let fixture: ComponentFixture<CommandPalette>;
  let palette: CommandPalette;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommandPalette] }).compileComponents();
    fixture = TestBed.createComponent(CommandPalette);
    palette = fixture.componentInstance;
    // setInput y no asignacion directa: cambiar una entrada a mano y pedir
    // repintado choca con la deteccion automatica de Angular (NG0100).
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('sin escribir nada las ofrece todas', () => {
    expect(palette.results.length).toBeGreaterThan(10);
  });

  it('filtra por lo que escribes', () => {
    palette.query = 'qr';
    expect(palette.results.some((c) => c.id === 'qr')).toBe(true);
  });

  it('también busca en las descripciones', () => {
    palette.query = 'planning';
    expect(palette.results.length).toBeGreaterThan(0);
  });

  it('lo que empieza por lo que escribes va primero', () => {
    palette.query = 'color';
    expect(palette.results[0].id).toBe('color');
  });

  it('no enseña los secretos', () => {
    palette.query = 'sudo';
    expect(palette.results).toEqual([]);
  });

  it('ni el cronómetro que se decidió esconder', () => {
    palette.query = 'throwdown';
    expect(palette.results).toEqual([]);
  });

  it('avisa de lo elegido y se cierra sola', () => {
    let elegido = '';
    let cerrada = false;
    palette.picked.subscribe((id) => (elegido = id));
    palette.closed.subscribe(() => (cerrada = true));
    palette.choose('juegos');
    expect(elegido).toBe('juegos');
    expect(cerrada).toBe(true);
  });

  it('Enter elige el primero de la lista', () => {
    let elegido = '';
    palette.picked.subscribe((id) => (elegido = id));
    palette.query = 'uuid';
    palette.onKey(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(elegido).toBe('uuid');
  });

  it('Enter sin resultados no elige nada', () => {
    let elegido = '';
    palette.picked.subscribe((id) => (elegido = id));
    palette.query = 'zzzzzzzz';
    palette.onKey(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(elegido).toBe('');
  });

  it('Escape la cierra', () => {
    let cerrada = false;
    palette.closed.subscribe(() => (cerrada = true));
    palette.onKey(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(cerrada).toBe(true);
  });

  it('al enfocarla se limpia lo escrito antes', () => {
    palette.query = 'restos de la vez anterior';
    palette.focus();
    expect(palette.query).toBe('');
  });

  it('cerrada no pinta nada', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.palette')).toBeFalsy();
  });
});
