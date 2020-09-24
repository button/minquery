const sinon = require('sinon');
const assert = require('assert');

const BearerCache = require('../bearer-cache');

describe('bearer-cache', function () {
  beforeEach(function () {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe('cold', function () {
    beforeEach(function () {
      this.cache = new BearerCache();
    });

    it('is in the cold state on construction', function () {
      assert(this.cache.isCold());
    });

    it('cannot return a value', function () {
      assert.throws(() => this.cache.value(), {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'Cache must be warm to return a value',
      });
    });

    it('cannot be waited on', function () {
      assert.throws(() => this.cache.wait(), {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'Cache must be fetching to wait on a value',
      });
    });

    it('can transition to fetching', function () {
      this.cache.setFetching();
      assert(this.cache.isFetching());
    });

    it('cannot transition to warm', function () {
      assert.throws(() => this.cache.setWarm('bloop', 1), {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'Cache must be fetching to set to warm',
      });
    });

    it('cannot transition to cold', function () {
      assert.throws(() => this.cache.setCold(new Error('bloop')), {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'Cache must be fetching to set to cold',
      });
    });
  });

  describe('fetching', function () {
    beforeEach(function () {
      this.cache = new BearerCache();
      this.cache.setFetching();
    });

    it('is in the fetching state', function () {
      assert(this.cache.isFetching());
    });

    it('cannot return a value', function () {
      assert.throws(() => this.cache.value(), {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'Cache must be warm to return a value',
      });
    });

    it('can be waited on', async function () {
      setImmediate(() => this.cache.setWarm('bloop', 1));
      assert(this.cache.isFetching());

      const res = await this.cache.wait();

      assert(this.cache.isWarm());
      assert.deepStrictEqual(res, 'bloop');
    });

    it('can be waited on and reject', async function () {
      setImmediate(() => this.cache.setCold(new Error('blooped the big one')));
      assert(this.cache.isFetching());

      await assert.rejects(() => this.cache.wait(), {
        name: 'Error',
        message: 'blooped the big one',
      });

      assert(this.cache.isCold());
    });

    it('can be waited on by multiple receivers', async function () {
      setImmediate(() => this.cache.setWarm('bloop', 1));
      assert(this.cache.isFetching());

      const res = await Promise.all([this.cache.wait(), this.cache.wait()]);

      assert(this.cache.isWarm());
      assert.deepStrictEqual(res, ['bloop', 'bloop']);
    });

    it('cannot transition to fetching', function () {
      assert.throws(() => this.cache.setFetching(), {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'Cache must be cold to set to fetching',
      });
    });

    it('can transition to warm', function () {
      this.cache.setWarm('bloop', 1);
      assert(this.cache.isWarm());
    });

    it('can transition to cold', async function () {
      setImmediate(() => this.cache.setCold(new Error('bloop')));

      await assert.rejects(() => this.cache.wait());

      assert(this.cache.isCold());
    });
  });

  describe('warm', function () {
    beforeEach(function () {
      this.clock = this.sandbox.useFakeTimers();
      this.cache = new BearerCache();
      this.cache.setFetching();
      this.cache.setWarm('bloop', 1);
    });

    it('is in the warm state', function () {
      assert(this.cache.isWarm());
    });

    it('can return a value', function () {
      assert.deepStrictEqual(this.cache.value(), 'bloop');
    });

    it('cannot be waited on', function () {
      assert.throws(() => this.cache.wait(), {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'Cache must be fetching to wait on a value',
      });
    });

    it('cannot transition to fetching', function () {
      assert.throws(() => this.cache.setFetching(), {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'Cache must be cold to set to fetching',
      });
    });

    it('cannot transition to warm', function () {
      assert.throws(() => this.cache.setWarm('bloop', 1), {
        name: 'AssertionError [ERR_ASSERTION]',
        message: 'Cache must be fetching to set to warm',
      });
    });

    it('can transition to cold', function () {
      assert(this.cache.isWarm());

      this.clock.tick(500);
      assert(this.cache.isWarm());

      this.clock.tick(500);
      assert(this.cache.isCold());
    });
  });
});
