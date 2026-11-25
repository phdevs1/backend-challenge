import { describe, expect, it } from 'vitest';
import { parseReply } from '../../src/inbound/reply.js';

describe('patient reply', () => {
  it.each(['SI', 'si', 'Sí', 'sí', ' si ', 'SI.', '¡Sí!'])('%j confirms', (text) => {
    expect(parseReply(text)).toBe('confirm');
  });

  it.each(['NO', 'no', 'No', ' no ', 'NO!', '...no...'])('%j cancels', (text) => {
    expect(parseReply(text)).toBe('cancel');
  });

  it.each(['', 'vale', 'si por favor', 'no puedo', 'sip', '👍'])('%j is ignored', (text) => {
    expect(parseReply(text)).toBeNull();
  });
});
