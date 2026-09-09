import { describe, expect, it } from 'vitest';
import {
  DEV_AVATARS,
  GAME_ART,
  IMPOSTOR_CAST,
  POKER_LEGENDS,
  RISK_BOT_PORTRAITS,
  RISK_COMMANDERS,
  RISK_FACTION_PORTRAITS,
  POKER_DEALER,
  TRIVIAL_CAST,
  TRIVIAL_HOST,
  avatarById,
  botPortraitSrc,
  commanderById,
  dealerSrc,
  hostSrc,
  impostorById,
  seatPortraitSrc,
} from './portraits';

describe('catálogo de retratos', () => {
  it('cada comandante tiene id, nombre y PNG', () => {
    expect(RISK_COMMANDERS).toHaveLength(6);
    for (const item of RISK_COMMANDERS) {
      expect(item.id).toBeTruthy();
      expect(item.src).toMatch(/assets\/risk\/commanders\/.+\.png$/);
    }
  });

  it('hay un retrato por cada perfil de bot', () => {
    expect(Object.keys(RISK_BOT_PORTRAITS).sort()).toEqual(
      ['agresivo', 'cauto', 'expansivo', 'oportunista', 'vengativo'].sort(),
    );
  });

  it('hay un retrato por cada facción de 1936', () => {
    expect(Object.keys(RISK_FACTION_PORTRAITS).sort()).toEqual(
      ['cnt-fai', 'ejercito-africa', 'ejercito-norte', 'ejercito-popular'].sort(),
    );
  });

  it('los avatares del poker no se pisan el id', () => {
    const ids = DEV_AVATARS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(avatarById('duck')?.name).toBe('Pato');
  });

  it('las leyendas de poker están en el selector', () => {
    expect(POKER_LEGENDS.length).toBeGreaterThanOrEqual(10);
    expect(avatarById('jobs')?.name).toBe('Jobs');
    expect(avatarById('musk')?.src).toContain('legends/musk.png');
    expect(avatarById('anon')?.name).toBe('Anonymous');
    expect(avatarById('neckbeard')?.src).toContain('neckbeard.png');
  });

  it('el presentador del trivial tiene idle, habla y reacciones', () => {
    expect(hostSrc('idle')).toContain('host/idle.png');
    expect(Object.keys(TRIVIAL_HOST).sort()).toEqual(
      ['idle', 'talk', 'talk2', 'think', 'wrong', 'yes'].sort(),
    );
  });

  it('el crupier del poker tiene idle y un mazo de expresiones', () => {
    expect(dealerSrc('idle')).toContain('poker/dealer/idle.png');
    expect(dealerSrc('sarcastic')).toContain('sarcastic.png');
    expect(Object.keys(POKER_DEALER).length).toBeGreaterThanOrEqual(12);
    expect(Object.values(POKER_DEALER).every((src) => src.endsWith('.png'))).toBe(true);
  });

  it('el elenco del trivial mezcla perfiles y no pisa ids', () => {
    expect(TRIVIAL_CAST.length).toBeGreaterThanOrEqual(10);
    const ids = TRIVIAL_CAST.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TRIVIAL_CAST.every((item) => item.blurb && item.blurb.length > 10)).toBe(true);
  });

  it('el elenco del impostor son memes clásicos y no pisa ids', () => {
    expect(IMPOSTOR_CAST.length).toBeGreaterThanOrEqual(20);
    const ids = IMPOSTOR_CAST.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(IMPOSTOR_CAST.every((item) => item.blurb && item.blurb.length > 10)).toBe(true);
    expect(IMPOSTOR_CAST.every((item) => item.src.endsWith('.png'))).toBe(true);
    expect(impostorById('doge')?.name).toBe('Doge');
    expect(impostorById('troll')?.src).toContain('impostor/cast/troll.png');
    expect(impostorById('floppa')?.name).toBe('Floppa');
    expect(impostorById('yuno')?.src).toContain('impostor/cast/yuno.png');
    expect(GAME_ART.impostor).toContain('games/impostor.png');
  });

  it('un humano enseña el comandante que eligió', () => {
    expect(seatPortraitSrc({ portraitId: 'hierro', kind: 'human' })).toBe(
      commanderById('hierro')?.src,
    );
  });

  it('un bot enseña la cara de su perfil, no un comandante suelto', () => {
    expect(seatPortraitSrc({ kind: 'bot', botProfile: 'cauto', portraitId: 'hierro' })).toBe(
      botPortraitSrc('cauto'),
    );
  });
});
