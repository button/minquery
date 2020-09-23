const STATES = {
  FETCHING: 'FETCHING',
  WARM: 'WARM',
  COLD: 'COLD',
};

class BearerCache {
  constructor() {
    this.token = null;
    this.expiresAt = null;
    this.fetcher = null;
    this.resolver = null;
    this.rejecter = null;
  }

  value() {
    return this.token;
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
    this.token = token;
    this.expiresAt = Date.now() + (lifetimeSecs * 1000);

    this.resolver(token);

    this.fetcher = null;
    this.resolver = null;
    this.rejecter = null;
  }

  setCold(reason) {
    this.token = null;
    this.expiresAt = null;

    this.rejecter(reason);

    this.fetcher = null;
    this.resolver = null;
    this.rejecter = null;
  }

  setFetching() {
    this.fetcher = new Promise((resolve, reject) => {
      this.resolver = resolve;
      this.rejecter = reject;
    });
  }

  wait() {
    return this.fetcher;
  }
}

module.exports = BearerCache;
