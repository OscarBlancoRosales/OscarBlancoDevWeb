import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CANAL_GENERAL, ChatLine, RiskRoster, RosterRow } from './risk-roster';

function ficha(over: Partial<RosterRow> & { id: string; name: string }): RosterRow {
  return {
    color: '#00e676',
    avatar: '🦁',
    territories: 5,
    armies: 12,
    eliminated: false,
    strength: 0.5,
    unread: 0,
    ...over,
  };
}

const FICHAS: RosterRow[] = [
  ficha({ id: 'p1', name: 'Óscar', avatar: '🦁' }),
  ficha({ id: 'p2', name: 'Napoleón', avatar: '👑', unread: 2 }),
  ficha({ id: 'p3', name: 'Sun Tzu', avatar: '🐉', eliminated: true }),
];

const LINEAS: ChatLine[] = [
  {
    key: 'm1',
    author: 'Napoleón',
    color: '#f00',
    text: 'No toques Lleida y te dejo Girona.',
    mine: false,
    fromLlm: true,
  },
  { key: 'm2', author: 'Óscar', color: '#0f0', text: 'Hecho.', mine: true, fromLlm: false },
];

describe('RiskRoster', () => {
  let fixture: ComponentFixture<RiskRoster>;

  function filas(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.roster-row'));
  }

  function filaDe(nombre: string): HTMLElement {
    return filas().find((f) => f.textContent?.includes(nombre))!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RiskRoster] }).compileComponents();
    fixture = TestBed.createComponent(RiskRoster);
    fixture.componentRef.setInput('rows', FICHAS);
    fixture.componentRef.setInput('meId', 'p1');
    fixture.componentRef.setInput('currentId', 'p2');
  });

  it('es un marcador: una ficha por jugador, con territorios y tropas', () => {
    fixture.detectChanges();
    const napoleon = filaDe('Napoleón');
    expect(napoleon.textContent).toContain('5');
    expect(napoleon.textContent).toContain('12');
    expect(napoleon.querySelector('.avatar')!.textContent!.trim()).toBe('👑');
  });

  it('marca de quién es el turno y quién está fuera', () => {
    fixture.detectChanges();
    expect(filaDe('Napoleón').classList.contains('current')).toBe(true);
    expect(filaDe('Sun Tzu').classList.contains('out')).toBe(true);
  });

  /**
   * El aviso de mensaje sin leer va sobre la cara, no en una lista aparte:
   * es donde se mira.
   */
  it('el aviso de sin leer va encima del avatar', () => {
    fixture.detectChanges();
    expect(filaDe('Napoleón').querySelector('.avatar .unread')).toBeTruthy();
    expect(filaDe('Sun Tzu').querySelector('.avatar .unread')).toBeNull();
  });

  describe('y es a la vez la lista de conversaciones', () => {
    it('tocar un avatar pide abrir su hilo', () => {
      fixture.detectChanges();
      const pedidos: (string | null)[] = [];
      fixture.componentInstance.openThreadChange.subscribe((id) => pedidos.push(id));
      filaDe('Napoleón').click();
      expect(pedidos).toEqual(['p2']);
    });

    it('volver a tocarlo lo cierra', () => {
      fixture.componentRef.setInput('openThread', 'p2');
      fixture.detectChanges();
      const pedidos: (string | null)[] = [];
      fixture.componentInstance.openThreadChange.subscribe((id) => pedidos.push(id));
      filaDe('Napoleón').click();
      expect(pedidos).toEqual([null]);
    });

    /** Con uno mismo no se chatea. */
    it('tu propia ficha no abre ningún hilo', () => {
      fixture.detectChanges();
      const mia = filaDe('Óscar');
      expect(mia.tagName).toBe('DIV');
      expect(mia.querySelector('.avatar.me')).toBeTruthy();
    });

    it('hay un canal para todos, además de los privados', () => {
      fixture.detectChanges();
      const pedidos: (string | null)[] = [];
      fixture.componentInstance.openThreadChange.subscribe((id) => pedidos.push(id));
      fixture.nativeElement.querySelector('.roster-row.general').click();
      expect(pedidos).toEqual([CANAL_GENERAL]);
    });

    it('cerrado no hay ninguna conversación en pantalla', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.thread')).toBeNull();
    });

    it('abierto enseña sólo los mensajes de ese hilo', () => {
      fixture.componentRef.setInput('openThread', 'p2');
      fixture.componentRef.setInput('lines', LINEAS);
      fixture.detectChanges();
      const lineas = fixture.nativeElement.querySelectorAll('.thread .line');
      expect(lineas.length).toBe(2);
      expect(lineas[0].textContent).toContain('No toques Lleida');
    });

    it('lo tuyo se distingue de lo suyo', () => {
      fixture.componentRef.setInput('openThread', 'p2');
      fixture.componentRef.setInput('lines', LINEAS);
      fixture.detectChanges();
      const lineas = fixture.nativeElement.querySelectorAll('.thread .line');
      expect(lineas[0].classList.contains('mine')).toBe(false);
      expect(lineas[1].classList.contains('mine')).toBe(true);
    });

    /** Saber si te habla una máquina o una regla del bot no es un detalle. */
    it('marca lo que ha escrito un modelo de lenguaje', () => {
      fixture.componentRef.setInput('openThread', 'p2');
      fixture.componentRef.setInput('lines', LINEAS);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.thread .llm').length).toBe(1);
    });

    it('el campo dice a quién le estás hablando', () => {
      fixture.componentRef.setInput('openThread', 'p2');
      fixture.detectChanges();
      const campo = fixture.nativeElement.querySelector('.thread-input input');
      expect(campo.getAttribute('placeholder')).toContain('Napoleón');
    });

    it('enviar avisa hacia fuera y vacía el campo', () => {
      fixture.componentRef.setInput('openThread', 'p2');
      fixture.detectChanges();
      const enviados: string[] = [];
      fixture.componentInstance.send.subscribe((t) => enviados.push(t));
      fixture.componentInstance.draft = '  pacto?  ';
      fixture.nativeElement.querySelector('.thread-input button').click();
      expect(enviados).toEqual(['pacto?']);
      expect(fixture.componentInstance.draft).toBe('');
    });

    it('no envía cadenas vacías', () => {
      fixture.componentRef.setInput('openThread', 'p2');
      fixture.detectChanges();
      const enviados: string[] = [];
      fixture.componentInstance.send.subscribe((t) => enviados.push(t));
      fixture.componentInstance.draft = '   ';
      fixture.nativeElement.querySelector('.thread-input button').click();
      expect(enviados).toEqual([]);
    });

    /**
     * El estratega analiza tu posición, no charla. Un campo de texto ahí
     * prometería una conversación que no existe.
     */
    it('una ficha que no conversa ofrece su botón en vez del campo', () => {
      fixture.componentRef.setInput('rows', [
        ...FICHAS,
        ficha({ id: 'advisor', name: 'Estratega', avatar: '🧠', askLabel: 'Pedir consejo' }),
      ]);
      fixture.componentRef.setInput('openThread', 'advisor');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.thread-input')).toBeNull();
      const boton = fixture.nativeElement.querySelector('.thread-ask');
      expect(boton.textContent).toContain('Pedir consejo');

      const pedidos: string[] = [];
      fixture.componentInstance.send.subscribe((t) => pedidos.push(t));
      boton.click();
      expect(pedidos).toEqual(['']);
    });

    it('avisa mientras el bot está escribiendo', () => {
      fixture.componentRef.setInput('openThread', 'p2');
      fixture.componentRef.setInput('waiting', true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.thread-waiting')).toBeTruthy();
    });
  });
});
