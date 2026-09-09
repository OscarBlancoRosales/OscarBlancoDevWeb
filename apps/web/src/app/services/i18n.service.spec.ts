import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from './i18n.service';

/**
 * El idioma con el que arranca la web.
 *
 * Antes salía siempre en castellano salvo que hubieras tocado la bandera, así
 * que a quien llegaba con el navegador en inglés le tocaba buscarla.
 */
describe('con qué idioma se abre la web', () => {
  /** Finge el idioma del navegador, que normalmente es de solo lectura. */
  function navegadorEn(idiomas: string[]): void {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(idiomas);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue(idiomas[0] ?? 'es');
  }

  function servicioNuevo(): I18nService {
    TestBed.resetTestingModule();
    return TestBed.inject(I18nService);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('con el navegador en español, en español', () => {
    navegadorEn(['es-ES', 'es']);
    expect(servicioNuevo().lang).toBe('es');
  });

  it('con el navegador en inglés, en inglés', () => {
    navegadorEn(['en-GB', 'en']);
    expect(servicioNuevo().lang).toBe('en');
  });

  it('en cualquier variante del español, en español', () => {
    for (const variante of ['es-AR', 'es-MX', 'ES']) {
      navegadorEn([variante]);
      expect(servicioNuevo().lang, variante).toBe('es');
    }
  });

  /** El sitio es de un español: ante la duda, castellano. */
  it('en un idioma que no hablamos, en español', () => {
    navegadorEn(['de-DE', 'fr']);
    expect(servicioNuevo().lang).toBe('es');
  });

  it('si el navegador no dice nada, en español', () => {
    navegadorEn([]);
    expect(servicioNuevo().lang).toBe('es');
  });

  it('lo que tú elegiste manda sobre el navegador', () => {
    localStorage.setItem('app_lang', 'en');
    navegadorEn(['es-ES']);
    expect(servicioNuevo().lang).toBe('en');
  });

  it('y elegirlo se recuerda para la próxima', () => {
    navegadorEn(['es-ES']);
    const i18n = servicioNuevo();
    i18n.setLang('en');
    expect(servicioNuevo().lang).toBe('en');
  });

  it('un valor corrupto guardado no rompe el arranque', () => {
    localStorage.setItem('app_lang', 'klingon');
    navegadorEn(['en-US']);
    expect(servicioNuevo().lang).toBe('en');
  });
});
