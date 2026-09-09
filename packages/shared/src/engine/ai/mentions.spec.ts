import { describe, expect, it } from 'vitest';
import { mentionedSeat, normalizeText } from './mentions';

const BOTS = [
  { id: 'b1', name: 'Forja' },
  { id: 'b2', name: 'Almirante Marea' },
  { id: 'b3', name: 'Marea' },
  { id: 'b4', name: 'Ana' },
];

describe('mentionedSeat', () => {
  it('encuentra al comandante nombrado', () => {
    expect(mentionedSeat(BOTS, 'Forja, no me ataques')?.id).toBe('b1');
  });

  it('no le importan las tildes ni las mayúsculas', () => {
    expect(mentionedSeat([{ id: 'x', name: 'Álex' }], 'oye alex, tregua')?.id).toBe('x');
  });

  it('gana el nombre más largo cuando uno contiene al otro', () => {
    expect(mentionedSeat(BOTS, 'Almirante Marea me da miedo')?.id).toBe('b2');
  });

  it('no contesta a un nombre escondido dentro de otra palabra', () => {
    // «Ana» está dentro de «mañana»: contestar ahí es lo que hace que el chat
    // parezca roto.
    expect(mentionedSeat(BOTS, 'mañana ataco por el norte')).toBeUndefined();
  });

  it('sin nombre no hay destinatario', () => {
    expect(mentionedSeat(BOTS, 'que empiece ya la partida')).toBeUndefined();
  });

  it('el nombre pegado a un signo sigue contando', () => {
    expect(mentionedSeat(BOTS, '¿forja? pacto ya')?.id).toBe('b1');
  });

  it('normalizeText quita tildes y baja a minúsculas', () => {
    expect(normalizeText('Castilla-La Máncha')).toBe('castilla-la mancha');
  });
});
