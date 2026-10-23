import { api } from '../../api/client';
import { webVersion } from '../../api/clientHeader';
import type { components } from '../../api/schema';
import { webClientName } from '../../lib/clients';

// Pairing of this browser with the phone (Backend `docs/contracts/connections.md`, Pairing). The QR carries
// the code, the browser's X25519 public key and a secret; Backend sees only their commitment.

type Schemas = components['schemas'];
type CreatedChallenge = Schemas['CreatedChallenge'];

/** `CONNECT` signs this browser in; `RENEW` is a fresh phone approval of the connection it already has. */
export type PairingKind = Schemas['CreateChallengeRequest']['kind'];

/** `PENDING` until the phone opens the code, `OPENED` until it approves, then `CLAIMED` once. */
export type ClaimStatus = Schemas['PairingClaimResponse']['status'];

export interface LoginChallenge extends CreatedChallenge {
  /** What the QR encodes: `https://<host>/pair#v1.<code>.<pk>.<s>`. */
  link: string;
  /** The six digits the phone shows next to the request, as `542 873`. */
  sas: string;
}

const CREATE_PATH = '/api/pair/challenges';
const RENEW_PATH = '/api/client/pair/renew';
const SECRET_BYTES = 16;

async function sha256(...parts: (string | Uint8Array)[]): Promise<Uint8Array> {
  const bytes = parts.map((part) =>
    typeof part === 'string' ? new TextEncoder().encode(part) : part,
  );
  const joined = new Uint8Array(bytes.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of bytes) {
    joined.set(part, offset);
    offset += part.length;
  }
  return new Uint8Array(await crypto.subtle.digest('SHA-256', joined));
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function uuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  return Uint8Array.from({ length: 16 }, (_, index) =>
    parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  );
}

/**
 * A fresh X25519 key pair and secret, kept in this page's memory only. The web never opens a sealed
 * bundle, so the private key is not extractable and is dropped with the challenge.
 */
async function createKeys(): Promise<{ publicKey: Uint8Array; secret: Uint8Array }> {
  const pair = (await crypto.subtle.generateKey({ name: 'X25519' }, false, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { publicKey, secret: crypto.getRandomValues(new Uint8Array(SECRET_BYTES)) };
}

/** `SHA-256("iw-pair-commit-v1" || pk || s)`, base64url without padding. */
export async function keyCommitment(publicKey: Uint8Array, secret: Uint8Array): Promise<string> {
  return base64url(await sha256('iw-pair-commit-v1', publicKey, secret));
}

/** The first 20 bits of `SHA-256("iw-pair-sas-v1" || challengeId || pk || s)` modulo 10^6. */
export async function verificationCode(
  challengeId: string,
  publicKey: Uint8Array,
  secret: Uint8Array,
): Promise<string> {
  const [a = 0, b = 0, c = 0] = await sha256(
    'iw-pair-sas-v1',
    uuidBytes(challengeId),
    publicKey,
    secret,
  );
  const digits = String(((a << 12) | (b << 4) | (c >> 4)) % 1_000_000).padStart(6, '0');
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export function pairLink(code: string, publicKey: Uint8Array, secret: Uint8Array): string {
  return `${window.location.origin}/pair#v1.${code}.${base64url(publicKey)}.${base64url(secret)}`;
}

export async function createChallenge(kind: PairingKind): Promise<LoginChallenge> {
  const { publicKey, secret } = await createKeys();
  const commitment = await keyCommitment(publicKey, secret);
  const created =
    kind === 'RENEW'
      ? await api.post<CreatedChallenge>(RENEW_PATH, {
          keyCommitment: commitment,
        } satisfies Schemas['RenewChallengeRequest'])
      : await api.post<CreatedChallenge>(CREATE_PATH, {
          kind,
          client: 'web',
          keyCommitment: commitment,
          name: webClientName(navigator.userAgent),
          version: webVersion(import.meta.env.VITE_REVISION as string | undefined),
          scopes: ['user'],
        } satisfies Schemas['CreateChallengeRequest']);
  return {
    ...created,
    link: pairLink(created.code, publicKey, secret),
    sas: await verificationCode(created.challengeId, publicKey, secret),
  };
}

/** One claim attempt; the `CLAIMED` answer of a new connection sets the `iw_client` cookie. */
export async function claim(challenge: LoginChallenge, signal?: AbortSignal): Promise<ClaimStatus> {
  const answer = await api.post<Schemas['PairingClaimResponse']>(
    `${CREATE_PATH}/${challenge.challengeId}/claim`,
    { claimSecret: challenge.claimSecret } satisfies Schemas['ClaimPairingRequest'],
    { signal },
  );
  return answer.status;
}
