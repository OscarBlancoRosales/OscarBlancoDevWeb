import { describe, expect, it, vi } from 'vitest';
import { Presentador } from './presentador';
import { DEFAULT_AI_SETTINGS } from '@devweb/shared/engine/ai/ai-client';
import type { AiSettings, ChatMessage } from '@devweb/shared/engine/ai/ai-client';

/** Un modelo de mentira con la firma de verdad, para que el mock tenga tipos. */
function modeloQue(
  responde: (mensajes: ChatMessage[]) => Promise<{ text: string; model: string }>,
) {
  return vi.fn((_ajustes: AiSettings, mensajes: ChatMessage[]) => responde(mensajes));
}

const DATOS = { quien: 'Ana', puntos: 150, ronda: 1, rondas: 10 };

const CON_IA: AiSettings = {
  ...DEFAULT_AI_SETTINGS,
  enabled: true,
  apiKey: 'una-clave',
};

describe('Presentador', () => {
  it('sin IA configurada suelta la frase del guion', async () => {
    const presentador = new Presentador(() => DEFAULT_AI_SETTINGS, vi.fn());
    const frase = await presentador.decir('bienvenida', DATOS, 1);

    expect(frase.length).toBeGreaterThan(10);
    expect(frase).not.toContain('{');
  });

  it('sin IA no llama a ningun modelo', async () => {
    const modelo = vi.fn();
    const presentador = new Presentador(() => DEFAULT_AI_SETTINGS, modelo);
    await presentador.decir('bienvenida', DATOS, 1);

    expect(modelo).not.toHaveBeenCalled();
  });

  it('con IA devuelve lo que dice el modelo', async () => {
    const modelo = modeloQue(() => Promise.resolve({ text: 'Buenas, panda de cracks.', model: 'm' }));
    const presentador = new Presentador(() => CON_IA, modelo);

    expect(await presentador.decir('bienvenida', DATOS, 1)).toBe('Buenas, panda de cracks.');
  });

  it('el guion viaja en el prompt, para que el modelo lo reescriba y no lo invente', async () => {
    const modelo = modeloQue(() => Promise.resolve({ text: 'lo que sea', model: 'm' }));
    const presentador = new Presentador(() => CON_IA, modelo);
    await presentador.decir('bienvenida', DATOS, 1);

    const mensajes = modelo.mock.calls[0]?.[1] ?? [];
    expect(mensajes[0]?.content).toContain('Óscar');
    expect(mensajes.at(-1)?.content.length).toBeGreaterThan(10);
  });

  it('si el modelo falla, se queda la frase del guion', async () => {
    const modelo = modeloQue(() => Promise.reject(new Error('sin red')));
    const presentador = new Presentador(() => CON_IA, modelo);

    const frase = await presentador.decir('bienvenida', DATOS, 1);
    expect(frase.length).toBeGreaterThan(10);
  });

  it('si el modelo devuelve basura, se queda la frase del guion', async () => {
    const guionado = await new Presentador(() => DEFAULT_AI_SETTINGS, vi.fn()).decir(
      'bienvenida',
      DATOS,
      7,
    );
    const modelo = modeloQue(() => Promise.resolve({ text: '   ', model: 'm' }));

    expect(await new Presentador(() => CON_IA, modelo).decir('bienvenida', DATOS, 7)).toBe(
      guionado,
    );
  });

  it('si el modelo se enrolla, tampoco cuela', async () => {
    // Un parrafón rompe la pantalla y no es lo que se le pidió.
    const modelo = modeloQue(() => Promise.resolve({ text: 'a'.repeat(500), model: 'm' }));
    const frase = await new Presentador(() => CON_IA, modelo).decir('bienvenida', DATOS, 1);

    expect(frase.length).toBeLessThan(400);
  });

  it('nunca lanza, pase lo que pase', async () => {
    const presentador = new Presentador(
      () => {
        throw new Error('el almacenamiento del navegador ha dicho que no');
      },
      vi.fn(),
    );

    await expect(presentador.decir('despedida', DATOS, 1)).resolves.toBeTruthy();
  });

  it('con la misma semilla y sin IA dice siempre lo mismo', async () => {
    const presentador = new Presentador(() => DEFAULT_AI_SETTINGS, vi.fn());
    const una = await presentador.decir('presentaRonda', DATOS, 3);
    const otra = await presentador.decir('presentaRonda', DATOS, 3);

    expect(una).toBe(otra);
  });
});
