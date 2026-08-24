import { describe, expect, it } from 'vitest';
import { BOT_SPEEDS, loadBotDelay, saveBotDelay } from './risk-game.service';

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  } as Storage;
}

describe('ritmo de los bots', () => {
  it('ofrece tres velocidades ordenadas de rápida a lenta', () => {
    expect(BOT_SPEEDS).toHaveLength(3);
    for (let i = 1; i < BOT_SPEEDS.length; i++) {
      expect(BOT_SPEEDS[i].ms).toBeGreaterThan(BOT_SPEEDS[i - 1].ms);
      expect(BOT_SPEEDS[i].label.length).toBeGreaterThan(3);
    }
  });

  it('por defecto juega a ritmo normal', () => {
    expect(loadBotDelay(fakeStorage())).toBe(900);
  });

  it('recuerda la velocidad elegida', () => {
    const storage = fakeStorage();
    saveBotDelay(250, storage);
    expect(loadBotDelay(storage)).toBe(250);
  });

  it('ignora valores corruptos', () => {
    const storage = fakeStorage();
    storage.setItem('risk_bot_delay', 'rapidísimo');
    expect(loadBotDelay(storage)).toBe(900);
  });

  it('acota los valores extremos', () => {
    const storage = fakeStorage();
    storage.setItem('risk_bot_delay', '-500');
    expect(loadBotDelay(storage)).toBe(0);
    storage.setItem('risk_bot_delay', '999999');
    expect(loadBotDelay(storage)).toBe(4000);
  });

  it('funciona sin almacenamiento', () => {
    expect(loadBotDelay(undefined)).toBe(900);
    expect(() => saveBotDelay(300, undefined)).not.toThrow();
  });
});
