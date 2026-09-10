import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { EntrarEnLaMesa } from './entrar';
import { MesaService } from '../mesa.service';
import { AuthApiService } from '../../api/auth-api.service';
import { RoomsApiService } from '../../api/rooms-api.service';
import type { RoomInfo, SeatInfo } from '@devweb/shared/contracts/rooms';

/**
 * La puerta de la mesa.
 *
 * Lo que se comprueba aquí es lo que evita la sorpresa al sentarse: una cara
 * que ya tiene alguien no se puede coger, y si la que traías por defecto está
 * pillada se cambia sola antes de que lo intentes.
 */

function asiento(id: string, avatar?: string): SeatInfo {
  return {
    id,
    displayName: id,
    isBot: false,
    connected: true,
    isOwner: false,
    order: 0,
    ...(avatar && { meta: { avatar } }),
  };
}

function sala(seats: SeatInfo[]): RoomInfo {
  return {
    id: 'sala-1',
    game: 'scrum',
    name: 'Mesa',
    status: 'playing',
    config: { version: 'mesa' },
    seats,
    createdAt: 0,
    updatedAt: 0,
  };
}

async function montar(seats: SeatInfo[], invitacion = 'sala-1') {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [EntrarEnLaMesa],
    providers: [
      provideRouter([]),
      { provide: MesaService, useValue: { crear: () => undefined, unirse: () => undefined } },
      { provide: AuthApiService, useValue: { settledUser$: of(null) } },
      { provide: RoomsApiService, useValue: { info: () => Promise.resolve(sala(seats)) } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(invitacion ? { sala: invitacion } : {}) },
        },
      },
    ],
  }).compileComponents();

  // Sin sesión y sin invitación la puerta manda al login, y aquí no hay rutas
  // que valgan: se corta la navegación para no llenar la salida de ruido.
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<EntrarEnLaMesa> = TestBed.createComponent(EntrarEnLaMesa);
  fixture.detectChanges();
  // Se consulta la sala al arrancar; hay que dejar que vuelva.
  await Promise.resolve();
  await Promise.resolve();
  fixture.changeDetectorRef.markForCheck();
  fixture.detectChanges();
  return fixture;
}

describe('elegir cara antes de sentarse', () => {
  let fixture: ComponentFixture<EntrarEnLaMesa>;

  beforeEach(async () => {
    fixture = await montar([asiento('a', 'turing'), asiento('b', 'hopper')]);
  });

  function caras(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.cara'));
  }

  function cara(nombre: string): HTMLButtonElement {
    const encontrada = caras().find((una) => una.textContent.trim() === nombre);
    if (!encontrada) throw new Error(`no está la cara de ${nombre}`);
    return encontrada;
  }

  it('se ofrecen todas las del catálogo', () => {
    expect(caras().length).toBeGreaterThan(20);
  });

  /** Elegir a ciegas una que ya tiene otro es llevarse la sorpresa al entrar. */
  it('las que ya tiene alguien no se pueden coger', () => {
    expect(cara('Turing').disabled).toBe(true);
    expect(cara('Hopper').disabled).toBe(true);
    expect(cara('Linus').disabled).toBe(false);
  });

  it('y se ven apagadas, para que se note por qué', () => {
    expect(cara('Turing').classList.contains('cogida')).toBe(true);
    expect(cara('Linus').classList.contains('cogida')).toBe(false);
  });

  it('el título dice que ya está en la mesa', () => {
    expect(cara('Turing').getAttribute('title')).toContain('ya está en la mesa');
  });

  /** La primera del catálogo es Turing: si está cogida, hay que moverse. */
  it('si la que venía puesta está cogida, se cambia sola a una libre', () => {
    expect(fixture.componentInstance.avatar).not.toBe('turing');
    expect(fixture.componentInstance.estaCogido(fixture.componentInstance.avatar)).toBe(false);
  });
});

describe('cuando no hay mesa que mirar', () => {
  it('sin invitación no hay ninguna cogida', async () => {
    const fixture = await montar([], '');
    const cogidas = (fixture.nativeElement as HTMLElement).querySelectorAll('.cara.cogida');
    expect(cogidas).toHaveLength(0);
  });

  /** Si la sala no se puede consultar, se elige a ciegas y ya se reparte. */
  it('si la consulta falla, se puede elegir igual', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EntrarEnLaMesa],
      providers: [
        provideRouter([]),
        { provide: MesaService, useValue: {} },
        { provide: AuthApiService, useValue: { settledUser$: of(null) } },
        { provide: RoomsApiService, useValue: { info: () => Promise.reject(new Error('caído')) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ sala: 'sala-1' }) } },
        },
      ],
    }).compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(EntrarEnLaMesa);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    const cogidas = (fixture.nativeElement as HTMLElement).querySelectorAll('.cara[disabled]');
    expect(cogidas).toHaveLength(0);
  });
});

/**
 * Abrir una mesa exige cuenta —alguien tiene que ser su dueño—, igual que en la
 * versión clásica. Lo que no puede pasar es que quien no la tenga se quede
 * mirando una pantalla sin nada que pulsar, que es lo que hacía antes.
 */
describe('la cuenta hace falta para abrir, no para sentarse', () => {
  async function puerta(usuario: unknown, invitacion: string) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EntrarEnLaMesa],
      providers: [
        provideRouter([]),
        { provide: MesaService, useValue: {} },
        { provide: AuthApiService, useValue: { settledUser$: of(usuario) } },
        { provide: RoomsApiService, useValue: { info: () => Promise.resolve(sala([])) } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(invitacion ? { sala: invitacion } : {}) },
          },
        },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    const ido = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture: ComponentFixture<EntrarEnLaMesa> = TestBed.createComponent(EntrarEnLaMesa);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    return { fixture, ido };
  }

  function botones(fixture: ComponentFixture<EntrarEnLaMesa>): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button.accion'),
    ).map((b) => b.textContent.trim());
  }

  it('sin sesión y sin invitación, lleva al login y vuelve aquí', async () => {
    const { ido } = await puerta(null, '');
    expect(ido).toHaveBeenCalledWith(['/auth'], {
      queryParams: { next: '/scrum-poker/entrar' },
    });
  });

  it('pero con invitación no se pide cuenta: para eso te invitan', async () => {
    const { fixture, ido } = await puerta(null, 'sala-1');
    expect(ido).not.toHaveBeenCalled();
    expect(botones(fixture)).toEqual(['Sentarme a la mesa']);
  });

  it('con sesión, el botón de abrir la mesa está a la vista', async () => {
    const { fixture } = await puerta({ id: 'u1' }, '');
    expect(botones(fixture)).toEqual(['Abrir la mesa']);
  });

  /** Si la sesión se cae estando aquí, tiene que quedar por dónde volver. */
  it('y si no hay sesión, siempre hay un botón para identificarse', async () => {
    const { fixture, ido } = await puerta(null, '');
    ido.mockClear();
    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent.includes('Entrar con mi cuenta'));
    expect(boton).toBeTruthy();
    boton?.click();
    expect(ido).toHaveBeenCalledWith(['/auth'], {
      queryParams: { next: '/scrum-poker/entrar' },
    });
  });
});
