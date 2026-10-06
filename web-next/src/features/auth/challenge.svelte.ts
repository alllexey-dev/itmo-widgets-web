import { ApiError } from '../../api/client';
import { createChallenge, pollChallenge, type LoginChallenge, type LoginStatus } from './login';

const POLL_INTERVAL_MS = 2_000;
const CLOCK_TICK_MS = 1_000;
/** The backend code lifetime, used when the browser clock disagrees with the server's. */
const DEFAULT_LIFETIME_MS = 2 * 60_000;
const MAX_LIFETIME_MS = 10 * 60_000;
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
  | { kind: 'expired' }
  | {
      kind: 'active';
      challenge: ActiveChallenge;
      /** Milliseconds until the code expires. */
      remaining: number;
      status: LoginStatus;
      /** The last poll did not reach the server; polling goes on. */
      offline: boolean;
    };

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
 * Phone sign-in for this browser: creates a code once, polls it every 2 s while the tab is
 * visible and the code is alive, replaces an expired code up to five times in a row and calls
 * `onApproved` once the app confirms. `start()` on mount, `stop()` on destroy.
 */
export class LoginFlow {
  challenge = $state.raw<ActiveChallenge | null>(null);
  status = $state<LoginStatus>('PENDING');
  creating = $state(false);
  createError = $state<Error | null>(null);
  offline = $state(false);
  /** 404 on a poll: an unknown id or a wrong secret, the code is gone for this browser. */
  gone = $state(false);
  now = $state(Date.now());
  renewals = $state(0);

  #onApproved: () => void;
  /** The code already replaced automatically; each code is replaced at most once. */
  #renewedFor: ActiveChallenge | null = null;
  #pollTimer: ReturnType<typeof setTimeout> | undefined;
  #clock: ReturnType<typeof setInterval> | undefined;
  #inFlight: AbortController | null = null;
  #stopped = false;
  #onVisibility = () => this.#wake();

  constructor(onApproved: () => void) {
    this.#onApproved = onApproved;
  }

  get state(): LoginState {
    const challenge = this.challenge;
    if (challenge && !this.#stale) {
      return {
        kind: 'active',
        challenge,
        remaining: Math.min(Math.max(challenge.deadline - this.now, 0), challenge.lifetime),
        status: this.status,
        offline: this.offline,
      };
    }
    if (this.creating) return { kind: 'loading' };
    if (this.createError) return { kind: 'failed', error: this.createError };
    if (challenge && this.renewals >= MAX_AUTO_RENEWALS) return { kind: 'expired' };
    return { kind: 'loading' };
  }

  start(): void {
    this.#stopped = false;
    document.addEventListener('visibilitychange', this.#onVisibility);
    this.#clock = setInterval(() => this.#wake(), CLOCK_TICK_MS);
    void this.#create();
  }

  stop(): void {
    this.#stopped = true;
    document.removeEventListener('visibilitychange', this.#onVisibility);
    clearInterval(this.#clock);
    this.#cancelPoll();
    this.#inFlight?.abort();
  }

  /** "Показать новый код" and "Повторить": a fresh code and a fresh renewal budget. */
  renew(): void {
    this.renewals = 0;
    void this.#create();
  }

  get #timeUp(): boolean {
    return this.challenge !== null && this.now >= this.challenge.deadline;
  }

  get #stale(): boolean {
    return this.challenge !== null && (this.#timeUp || this.status === 'EXPIRED' || this.gone);
  }

  async #create(automatic = false): Promise<void> {
    if (this.creating) return;
    this.creating = true;
    this.createError = null;
    this.#cancelPoll();
    this.#inFlight?.abort();
    try {
      const created = activate(await createChallenge());
      if (this.#stopped) return;
      if (automatic) this.renewals += 1;
      this.challenge = created;
      this.status = 'PENDING';
      this.gone = false;
      this.offline = false;
      this.now = Date.now();
      this.#schedulePoll(0);
    } catch (error) {
      if (this.#stopped) return;
      this.createError = error instanceof Error ? error : new Error(String(error));
    } finally {
      this.creating = false;
    }
  }

  /** The clock ticked or the tab came back: refresh the countdown, poll at once, renew a dead code. */
  #wake(): void {
    if (this.#stopped) return;
    this.now = Date.now();
    if (!pageVisible()) {
      this.#cancelPoll();
      return;
    }
    if (this.#stale) {
      this.#renewIfAllowed();
      return;
    }
    if (this.#pollTimer === undefined && this.#inFlight === null) this.#schedulePoll(0);
  }

  #renewIfAllowed(): void {
    const challenge = this.challenge;
    if (!challenge || this.creating || this.createError) return;
    if (this.renewals >= MAX_AUTO_RENEWALS || this.#renewedFor === challenge) return;
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
    const challenge = this.challenge;
    if (this.#stopped || !challenge || !pageVisible()) return;
    this.now = Date.now();
    if (this.#stale) {
      this.#renewIfAllowed();
      return;
    }
    const controller = new AbortController();
    this.#inFlight = controller;
    try {
      const status = await pollChallenge(challenge, controller.signal);
      if (controller.signal.aborted || this.challenge !== challenge) return;
      this.status = status;
      this.offline = false;
    } catch (error) {
      if (controller.signal.aborted || this.challenge !== challenge) return;
      if (error instanceof ApiError && error.status === 404) this.gone = true;
      this.offline = error instanceof ApiError && error.isNetwork;
    } finally {
      if (this.#inFlight === controller) this.#inFlight = null;
    }
    if (this.status === 'APPROVED') {
      this.stop();
      this.#onApproved();
      return;
    }
    if (this.#stale) this.#renewIfAllowed();
    else if (pageVisible()) this.#schedulePoll(POLL_INTERVAL_MS);
  }
}
