import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { Registro } from './registro/registro';
import { Verificar } from './verificar/verificar';
import { Olvide } from './olvide/olvide';
import { NuevaContrasena, coinciden } from './nueva-contrasena/nueva-contrasena';
import { AuthApiService } from '../api/auth-api.service';
import { ApiError } from '../api/api-client';
import type { Type } from '@angular/core';
import type { FormGroup } from '@angular/forms';

async function montar<T>(
  componente: Type<T>,
  auth: Partial<AuthApiService>,
  params: Record<string, string> = {},
): Promise<ComponentFixture<T>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [componente],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
      },
      { provide: AuthApiService, useValue: auth },
    ],
  }).compileComponents();
  return TestBed.createComponent(componente);
}

const texto = (fixture: ComponentFixture<unknown>): string => {
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).textContent;
};

describe('Crear cuenta', () => {
  const DATOS = {
    displayName: 'Óscar',
    email: 'oscar@ejemplo.com',
    password: 'contrasena-larguisima',
  };

  it('no deja enviar una contraseña más corta de lo que el servidor acepta', async () => {
    const fixture = await montar(Registro, { registrar: vi.fn() });
    const { componentInstance: registro } = fixture;

    registro.formulario.setValue({ ...DATOS, password: 'corta' });

    expect(registro.password?.errors?.['minlength']).toBeTruthy();
    expect(registro.formulario.invalid).toBe(true);
  });

  it('manda el alta y cambia el formulario por el aviso', async () => {
    const registrarSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar(Registro, { registrar: registrarSpy });
    const { componentInstance: registro } = fixture;

    registro.formulario.setValue(DATOS);
    await registro.registrar();

    expect(registrarSpy).toHaveBeenCalledWith(DATOS.email, DATOS.password, DATOS.displayName);
    expect(registro.hecho()).toBe(true);
  });

  /**
   * El servidor contesta lo mismo exista o no el correo, y la pantalla tiene
   * que sostener esa decisión: si dijera "ya registrado", cualquiera podría
   * averiguar quién tiene cuenta probando direcciones.
   */
  it('el aviso no dice si el correo ya estaba dado de alta', async () => {
    const fixture = await montar(Registro, { registrar: vi.fn().mockResolvedValue(undefined) });
    const { componentInstance: registro } = fixture;

    registro.formulario.setValue(DATOS);
    await registro.registrar();

    expect(texto(fixture)).toContain('Si ese correo no estaba dado de alta ya');
  });

  it('si el servidor rechaza el alta, se enseña su motivo', async () => {
    const fixture = await montar(Registro, {
      registrar: vi.fn().mockRejectedValue(new ApiError('correo-invalido', 'Ese correo no vale.', 400)),
    });
    const { componentInstance: registro } = fixture;

    registro.formulario.setValue(DATOS);
    await registro.registrar();

    expect(registro.hecho()).toBe(false);
    expect(registro.error()).toBe('Ese correo no vale.');
  });

  it('mientras se envía no se puede enviar otra vez', async () => {
    const registrarSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar(Registro, { registrar: registrarSpy });
    const { componentInstance: registro } = fixture;

    registro.formulario.setValue(DATOS);
    const primera = registro.registrar();
    await registro.registrar();
    await primera;

    expect(registrarSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Verificar la cuenta', () => {
  it('canjea el código que viene en el enlace', async () => {
    const verificarSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar(Verificar, { verificar: verificarSpy }, { token: 'abc123' });

    await fixture.componentInstance.comprobar();

    expect(verificarSpy).toHaveBeenCalledWith('abc123');
    expect(fixture.componentInstance.estado()).toBe('activada');
    expect(texto(fixture)).toContain('Cuenta activada');
  });

  it('sin código no se llama al servidor y se dice qué pasa', async () => {
    const verificarSpy = vi.fn();
    const fixture = await montar(Verificar, { verificar: verificarSpy });

    await fixture.componentInstance.comprobar();

    expect(verificarSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.estado()).toBe('fallo');
  });

  /**
   * El token se gasta al activar la cuenta, así que abrir el correo dos veces
   * cae aquí. Es el caso normal, y la salida es pedir otro enlace.
   */
  it('con un código caducado ofrece volver a darse de alta', async () => {
    const fixture = await montar(
      Verificar,
      { verificar: vi.fn().mockRejectedValue(new ApiError('token-invalido', 'Enlace caducado.', 400)) },
      { token: 'viejo' },
    );

    await fixture.componentInstance.comprobar();

    expect(fixture.componentInstance.error()).toBe('Enlace caducado.');
    expect(texto(fixture)).toContain('vuelve a darte de alta');
  });
});

describe('Contraseña olvidada', () => {
  it('pide el enlace y no revela si ese correo tiene cuenta', async () => {
    const pedirSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar(Olvide, { pedirCambioDeContrasena: pedirSpy });
    const { componentInstance: olvide } = fixture;

    olvide.formulario.setValue({ email: 'quien@sea.com' });
    await olvide.pedir();

    expect(pedirSpy).toHaveBeenCalledWith('quien@sea.com');
    expect(texto(fixture)).toContain('Si ese correo tiene cuenta');
  });
});

describe('Contraseña nueva', () => {
  const validador = (password: string, repetida: string): boolean => {
    const grupo = {
      get: (campo: string) => ({ value: campo === 'password' ? password : repetida }),
    } as unknown as FormGroup;
    return coinciden(grupo) === null;
  };

  it('las dos tienen que ser iguales', () => {
    expect(validador('contrasena-larga', 'contrasena-larga')).toBe(true);
    expect(validador('contrasena-larga', 'otra-cosa')).toBe(false);
  });

  it('mientras no hayas escrito la repetición no se te riñe', () => {
    expect(validador('contrasena-larga', '')).toBe(true);
  });

  it('con el código del enlace, cambia la contraseña y te lleva a entrar', async () => {
    const cambiarSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = await montar(
      NuevaContrasena,
      { cambiarContrasena: cambiarSpy },
      { token: 'tok' },
    );
    const { componentInstance: pantalla } = fixture;
    pantalla.ngOnInit();
    const ir = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    pantalla.formulario.setValue({
      password: 'contrasena-larguisima',
      repetida: 'contrasena-larguisima',
    });
    await pantalla.cambiar();

    expect(cambiarSpy).toHaveBeenCalledWith('tok', 'contrasena-larguisima');
    expect(ir).toHaveBeenCalledWith(['/auth']);
  });

  it('sin código no se enseña el formulario', async () => {
    const cambiarSpy = vi.fn();
    const fixture = await montar(NuevaContrasena, { cambiarContrasena: cambiarSpy });
    const { componentInstance: pantalla } = fixture;

    pantalla.ngOnInit();
    await pantalla.cambiar();

    expect(pantalla.hayToken()).toBe(false);
    expect(cambiarSpy).not.toHaveBeenCalled();
    expect(texto(fixture)).toContain('Pide otro enlace');
  });
});
