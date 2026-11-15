import { ApiError } from '../../api/client';
import {
  claim,
  createChallenge,
  type ClaimStatus,
  type LoginChallenge,
  type PairingKind,
} from './pairing';

const POLL_INTERVAL_MS = 2_000;
const CLOCK_TICK_MS = 1_000;
/** The backend code lifetime, used when the browser clock disagrees with the server's. */
const DEFAULT_LIFETIME_MS = 2 * 60_000;
const MAX_LIFETIME_MS = 10 * 60_000;
/** Backend gives an opened code 10 minutes from the first open. */
const OPENED_LIFETIME_MS = 10 * 60_000;
/**
 * Codes replaced without a click; then the page waits for the user. Five renewals are
 * about 12 minutes, below the backend limit of 10 codes per address in 10 minutes.
 */
const MAX_AUTO_RENEWALS = 5;

export interface ActiveChallenge extends LoginChallenge {
  /** Local time when the code stops working. */
  deadline: number;
  lifetime: number;
}

export type LoginState =
  | { kind: 'loading' }
  | { kind: 'failed'; error: Error }
  | {
      kind: 'expired';
      /** The dead code's link: the page shows its QR faded under "Новый код". */
      link: string;
    }
  | {
      kind: 'active';
      challenge: ActiveChallenge;
      /** Milliseconds until the code expires. */
      remaining: number;
      status: ClaimStatus;
      /** The last poll did not reach the server; polling goes on. */
      offline: boolean;
    };

const LOADING: LoginState = { kind: 'loading' };

function activate(challenge: LoginChallenge): ActiveChallenge {
  const receivedAt = Date.now();
  const serverLifetime = Date.parse(challenge.expiresAt) - receivedAt;
  const lifetime =
    serverLifetime > 0 && serverLifetime <= MAX_LIFETIME_MS ? serverLifetime : DEFAULT_LIFETIME_MS;
  return { ...challenge, lifetime, deadline: receivedAt + lifetime };
}

function pageVisible(): boolean {
  return document.visibilityState !== 'hidden';
}

/**
 * Phone approval of this browser: creates a challenge of [kind] once, claims it every 2 s while
 * the tab is visible and the code is alive, replaces an expired code up to five times in a row and
 * calls `onApproved` once the claim succeeds. `start()` on mount, `stop()` on unmount; a stopped
 * flow can start again and picks up the code it has. The state is an external store for
 * `useSyncExternalStore` (`subscribe`, `getState`).
 */
export class LoginFlow {
  #challenge: ActiveChallenge | null = null;
  #status: ClaimStatus = 'PENDING';
  #creating = false;
  #createError: Error | null = null;
  #offline = false;
  /** 404 on a claim: expired, unknown or already claimed, the code is gone for this browser. */
  #gone = false;
  #now = Date.now();
  #renewals = 0;

  readonly #kind: PairingKind;
  #onApproved: () => void = () => undefined;
  /** The code already replaced automatically; each code is replaced at most once. */
  #renewedFor: ActiveChallenge | null = null;
  #pollTimer: ReturnType<typeof setTimeout> | undefined;
  #clock: ReturnType<typeof setInterval> | undefined;
  #inFlight: AbortController | null = null;
  #stopped = true;
  #approved = false;
  readonly #onVisibility = () => this.#wake();

  readonly #listeners = new Set<() => void>();
  #state: LoginState = LOADING;

  constructor(kind: PairingKind) {
    this.#kind = kind;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  readonly getState = (): LoginState => this.#state;

  start(onApproved: () => void): void {
    this.#onApproved = onApproved;
    if (!this.#stopped || this.#approved) return;
    this.#stopped = false;
    document.addEventListener('visibilitychange', this.#onVisibility);
    this.#clock = setInterval(() => this.#wake(), CLOCK_TICK_MS);
    if (this.#challenge) this.#wake();
    else void this.#create();
  }

  stop(): void {
    this.#stopped = true;
    document.removeEventListener('visibilitychange', this.#onVisibility);
    clearInterval(this.#clock);
    this.#cancelPoll();
    this.#inFlight?.abort();
    this.#inFlight = null;
  }

  /** "Новый код" and "Повторить": a fresh code and a fresh renewal budget. */
  renew(): void {
    this.#renewals = 0;
    void this.#create();
  }

  get #timeUp(): boolean {
    return this.#challenge !== null && this.#now >= this.#challenge.deadline;
  }

  get #stale(): boolean {
    return this.#challenge !== null && (this.#timeUp || this.#gone);
  }

  #read(): LoginState {
    const challenge = this.#challenge;
    if (challenge && !this.#stale) {
      return {
        kind: 'active',
        challenge,
        remaining: Math.min(Math.max(challenge.deadline - this.#now, 0), challenge.lifetime),
        status: this.#status,
        offline: this.#offline,
      };
    }
    if (this.#creating) return LOADING;
    if (this.#createError) return { kind: 'failed', error: this.#createError };
    if (challenge && this.#renewals >= MAX_AUTO_RENEWALS) {
      return { kind: 'expired', link: challenge.link };
    }
    return LOADING;
  }

  /** Publishes the state after a change. */
  #changed(): void {
    this.#state = this.#read();
    this.#listeners.forEach((listener) => listener());
  }

  async #create(automatic = false): Promise<void> {
    if (this.#creating) return;
    this.#creating = true;
    this.#createError = null;
    this.#cancelPoll();
    this.#inFlight?.abort();
    this.#inFlight = null;
    this.#changed();
    try {
      const created = activate(await createChallenge(this.#kind));
      if (automatic) this.#renewals += 1;
      this.#challenge = created;
      this.#status = 'PENDING';
      this.#gone = false;
      this.#offline = false;
      this.#now = Date.now();
      if (!this.#stopped) this.#schedulePoll(0);
    } catch (error) {
      this.#createError = error instanceof Error ? error : new Error(String(error));
    } finally {
      this.#creating = false;
      this.#changed();
    }
  }

  /** The clock ticked or the tab came back: refresh the countdown, poll at once, renew a dead code. */
  #wake(): void {
    if (this.#stopped) return;
    this.#now = Date.now();
    this.#changed();
    if (!pageVisible()) {
      this.#cancelPoll();
      return;
    }
    if (this.#stale) {
      this.#renewIfAllowed();
      return;
    }
    if (this.#challenge && this.#pollTimer === undefined && this.#inFlight === null) {
      this.#schedulePoll(0);
    }
  }

  #renewIfAllowed(): void {
    const challenge = this.#challenge;
    if (!challenge || this.#creating || this.#createError) return;
    if (this.#renewals >= MAX_AUTO_RENEWALS || this.#renewedFor === challenge) return;
    this.#renewedFor = challenge;
    void this.#create(true);
  }

  #cancelPoll(): void {
    clearTimeout(this.#pollTimer);
    this.#pollTimer = undefined;
  }

  #schedulePoll(delay: number): void {
    clearTimeout(this.#pollTimer);
    this.#pollTimer = setTimeout(() => {
      this.#pollTimer = undefined;
      void this.#poll();
    }, delay);
  }

  async #poll(): Promise<void> {
    const challenge = this.#challenge;
    if (this.#stopped || !challenge || !pageVisible()) return;
    this.#now = Date.now();
    if (this.#stale) {
      this.#changed();
      this.#renewIfAllowed();
      return;
    }
    const controller = new AbortController();
    this.#inFlight = controller;
    try {
      const status = await claim(challenge, controller.signal);
      if (controller.signal.aborted || this.#challenge !== challenge) return;
      if (status === 'OPENED' && this.#status === 'PENDING') {
        this.#challenge = {
          ...challenge,
          lifetime: OPENED_LIFETIME_MS,
          deadline: Date.now() + OPENED_LIFETIME_MS,
        };
      }
      this.#status = status;
      this.#offline = false;
    } catch (error) {
      if (controller.signal.aborted || this.#challenge !== challenge) return;
      if (error instanceof ApiError && error.status === 404) this.#gone = true;
      this.#offline = error instanceof ApiError && error.isNetwork;
    } finally {
      if (this.#inFlight === controller) this.#inFlight = null;
    }
    this.#now = Date.now();
    this.#changed();
    if (this.#status === 'CLAIMED') {
      this.#approved = true;
      this.stop();
      this.#onApproved();
      return;
    }
    if (this.#stale) this.#renewIfAllowed();
    else if (pageVisible()) this.#schedulePoll(POLL_INTERVAL_MS);
  }
}
