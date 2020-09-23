const assert = require('assert');

const STATES = {
  COLD: 'COLD',
  FETCHING: 'FETCHING',
  WARM: 'WARM',
};

/**
 * The BearerCache implements a simple state machine for managing the lifecycle
 * of an authentication token.
 *
 * When instantiated, a cache will be in the Cold state: it has no token. The
 * Cold state can transition to the Fetching state, indicating that a request
 * has been initiated for a token.
 *
 * In the Fetching state, callers can queue up for the result by awaiting the
 * promise returned by #wait. If the fetch fails, the cache can transition to
 * the Cold state -- anyone awaiting the result will receive a rejection with
 * the reason. If the fetch succeeds, the cache can transition to the Warm state
 * -- anyone awaiting the result will receive a resolution with the token.
 *
 * In the Warm state, callers can simply query for the token with #value. When
 * a token is deemed expired, based on a finite lifetime, the cache
 * automatically transitions back to Cold.
 *
 *            ┌───────────┐         ┌───────────┐
 *            │           ├──Fetch──▶           │
 * ───Create──▶   Cold    │         │ Fetching  │
 *            │           ◀──Fail───┤           │
 *            └─────▲─────┘         └─────┬─────┘
 *                  │                     │
 *               Expire  ┌───────────┐ Succeed
 *                  │    │           │    │
 *                  └────│   Warm    ◀────┘
 *                       │           │
 *                       └───────────┘
 */
class BearerCache {
  constructor() {
    this.token = null;
    this.expiresAt = null;
    this.fetcher = null;
    this.resolver = null;
    this.rejecter = null;
  }

  state() {
    if (this.fetcher !== null) {
      return STATES.FETCHING;
    }

    if (this.token && this.expiresAt > Date.now()) {
      return STATES.WARM;
    }

    return STATES.COLD;
  }

  isWarm() {
    return this.state() === STATES.WARM;
  }

  isCold() {
    return this.state() === STATES.COLD;
  }

  isFetching() {
    return this.state() === STATES.FETCHING;
  }

  setWarm(token, lifetimeSecs) {
    assert(this.isFetching(), 'Cache must be fetching to set to warm');

    this.token = token;
    this.expiresAt = Date.now() + (lifetimeSecs * 1000);

    this.resolver(token);

    this.fetcher = null;
    this.resolver = null;
    this.rejecter = null;
  }

  setCold(reason) {
    assert(this.isFetching(), 'Cache must be fetching to set to cold');

    this.token = null;
    this.expiresAt = null;

    this.rejecter(reason);

    this.fetcher = null;
    this.resolver = null;
    this.rejecter = null;
  }

  setFetching() {
    assert(this.isCold(), 'Cache must be cold to set to fetching');

    this.fetcher = new Promise((resolve, reject) => {
      this.resolver = resolve;
      this.rejecter = reject;
    });
  }

  value() {
    assert(this.isWarm(), 'Cache must be warm to return a value');
    return this.token;
  }

  wait() {
    assert(this.isFetching(), 'Cache must be fetching to wait on a value');
    return this.fetcher;
  }
}

module.exports = BearerCache;
