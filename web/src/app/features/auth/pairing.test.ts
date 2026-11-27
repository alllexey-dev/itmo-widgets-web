import { describe, expect, it } from 'vitest';
import { keyCommitment, pairLink } from './pairing';

// The vector was computed with the agent's `internal/pair` (Go) for pk = 01..20 and s = a0..af; the
// phone (`PairingCrypto`) derives the same bytes.
const publicKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const secret = Uint8Array.from({ length: 16 }, (_, index) => 0xa0 + index);

describe('pairing crypto', () => {
  it('commits to the key and the secret', async () => {
    expect(await keyCommitment(publicKey, secret)).toBe(
      'spUwdThOv9TPz1KkzHrH8TCi-Z7A1lG7FkH_XleA6sk',
    );
  });

  it('puts the key and the secret only into the fragment', () => {
    expect(pairLink('K7Q2M9AB', publicKey, secret)).toBe(
      `${location.origin}/pair#v1.K7Q2M9AB.AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA.oKGio6SlpqeoqaqrrK2urw`,
    );
  });
});
