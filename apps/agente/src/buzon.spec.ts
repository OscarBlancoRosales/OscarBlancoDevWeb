import { describe, expect, it, vi } from 'vitest';
import { Buzon } from './buzon';

/**
 * El buzón es lo que se dicen tu web y tu sesión de Claude Code, más los
 * permisos que Claude pide por el camino. Aquí no hay MCP ni HTTP: solo las
 * reglas, que son las que hay que poder leer de un vistazo.
 */
describe('el buzón del canal', () => {
  it('lo que escribes sale hacia la sesión', () => {
    const empujar = vi.fn();
    const buzon = new Buzon(empujar);

    buzon.escribir('arregla el icono');

    expect(empujar).toHaveBeenCalledWith('arregla el icono');
  });

  it('y queda en la conversación, para poder leerla', () => {
    const buzon = new Buzon(vi.fn());

    buzon.escribir('hola');
    buzon.responder('qué tal');

    expect(buzon.conversacion().map((m) => [m.de, m.texto])).toEqual([
      ['yo', 'hola'],
      ['claude', 'qué tal'],
    ]);
  });

  it('un mensaje vacío no se manda', () => {
    const empujar = vi.fn();
    const buzon = new Buzon(empujar);

    buzon.escribir('   ');

    expect(empujar).not.toHaveBeenCalled();
    expect(buzon.conversacion()).toEqual([]);
  });

  /** Una conversación larga no puede crecer sin fin en memoria. */
  it('la conversación se queda con lo último', () => {
    const buzon = new Buzon(vi.fn());

    for (let i = 0; i < 300; i++) buzon.responder(`mensaje ${i}`);

    expect(buzon.conversacion().length).toBeLessThanOrEqual(200);
    expect(buzon.conversacion().at(-1)?.texto).toBe('mensaje 299');
  });

  describe('los permisos que Claude pide', () => {
    it('quedan pendientes hasta que alguien conteste', () => {
      const buzon = new Buzon(vi.fn());

      buzon.pedirPermiso({
        id: 'abcde',
        herramienta: 'Bash',
        descripcion: 'Ejecutar las pruebas',
        detalle: 'npm test',
      });

      expect(buzon.pendientes()).toHaveLength(1);
      expect(buzon.pendientes()[0].herramienta).toBe('Bash');
    });

    it('contestar lo saca de la lista y avisa a la sesión', () => {
      const veredicto = vi.fn();
      const buzon = new Buzon(vi.fn(), veredicto);
      buzon.pedirPermiso({ id: 'abcde', herramienta: 'Bash', descripcion: 'x', detalle: 'y' });

      const valio = buzon.decidir('abcde', 'allow');

      expect(valio).toBe(true);
      expect(veredicto).toHaveBeenCalledWith('abcde', 'allow');
      expect(buzon.pendientes()).toEqual([]);
    });

    /**
     * Claude Code solo acepta veredictos con un identificador que él emitió.
     * Aquí se comprueba lo mismo antes de mandarlo: un «sí» suelto no autoriza
     * nada, y menos si llega de una pestaña que lleva horas abierta.
     */
    it('un identificador que no está pendiente no autoriza nada', () => {
      const veredicto = vi.fn();
      const buzon = new Buzon(vi.fn(), veredicto);

      expect(buzon.decidir('inventado', 'allow')).toBe(false);
      expect(veredicto).not.toHaveBeenCalled();
    });

    it('y no se puede contestar dos veces a lo mismo', () => {
      const veredicto = vi.fn();
      const buzon = new Buzon(vi.fn(), veredicto);
      buzon.pedirPermiso({ id: 'abcde', herramienta: 'Bash', descripcion: 'x', detalle: 'y' });

      buzon.decidir('abcde', 'allow');

      expect(buzon.decidir('abcde', 'deny')).toBe(false);
      expect(veredicto).toHaveBeenCalledTimes(1);
    });

    /** Si contestas en el terminal, el de aquí deja de tener sentido. */
    it('se puede retirar uno que ya se contestó en el ordenador', () => {
      const buzon = new Buzon(vi.fn());
      buzon.pedirPermiso({ id: 'abcde', herramienta: 'Bash', descripcion: 'x', detalle: 'y' });

      buzon.retirar('abcde');

      expect(buzon.pendientes()).toEqual([]);
    });
  });
});
