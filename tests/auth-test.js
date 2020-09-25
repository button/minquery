/* eslint-disable max-len, no-await-in-loop */

const { readFileSync } = require('fs');
const nock = require('nock');
const sinon = require('sinon');
const assert = require('assert');

const { getBearer } = require('../auth');
const BearerCache = require('../bearer-cache');

const key = readFileSync(`${__dirname}/fixtures/fake-key.pem`);

describe('auth', function () {
  beforeEach(function () {
    this.sandbox = sinon.createSandbox();
    this.clock = this.sandbox.useFakeTimers(0);

    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  afterEach(function () {
    this.sandbox.restore();

    nock.enableNetConnect();
    nock.cleanAll();
  });

  describe('#getBearer', function () {
    beforeEach(function () {
      this.cache = new BearerCache();
      this.arguments = {
        bearerCache: this.cache,
        key,
        email: 'daniel@hoho.com',
        scopes: ['bloop', 'bleep'],
      };
    });

    it('returns a cached token', async function () {
      this.cache.setFetching();
      this.cache.setWarm('token', 1);

      const res = await getBearer(this.arguments);

      assert.deepStrictEqual(res, 'token');
    });

    it('requests a new token when cold and allows other calls to wait', async function () {
      const scope = nock('https://oauth2.googleapis.com')
        .post('/token', {
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion:
            'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkYW5pZWxAaG9oby5jb20iLCJzY29wZSI6ImJsb29wIGJsZWVwIiwiYXVkIjoiaHR0cHM6Ly9vYXV0aDIuZ29vZ2xlYXBpcy5jb20vdG9rZW4iLCJleHAiOjM2MDAsImlhdCI6MH0=.inXy76Q7+cBzbygepCDcPDE254HmU1iOhxhi/hRWm5rkVW8EckMek5qkC90eUY08QZLL1d3UXiZf75iJXC8jtIMLNX+NZmp9fTPFvRkWtxhhvwGLxBzZr42yv06rHKH3+WizGiooz/u9aOpplnVFreZsXrxJyo/6WfD6+lnr3yBDcK0h2C0UUNfA7/8ELJ43pM+tHrGHk0z15M0d8MUpm1vUTh7s4cjCM8cYc/s8KndMIaJftjA+kZzYmQCv5C7/YRSQByHYNa25wIpi50wssnuxxej6GBOXShAURXxgdrZIqNpIIi+E3zTU12vVheq5UoysZyp7J5g1e+Ych06U7g==',
        })
        .reply(200, { access_token: 'token', expires_in: 3600 });

      const p1 = getBearer(this.arguments);
      const p2 = getBearer(this.arguments);
      const p3 = getBearer(this.arguments);

      assert.deepStrictEqual(await Promise.all([p1, p2, p3]), [
        'token',
        'token',
        'token',
      ]);

      scope.done();

      // Now that the cache is warm, we can get the value without extra network
      // hops
      assert.deepStrictEqual(await getBearer(this.arguments), 'token');

      // Now let the token expire
      this.clock.tick(60 * 55 * 1000);

      const refreshScope = nock('https://oauth2.googleapis.com')
        .post('/token', {
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion:
            'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkYW5pZWxAaG9oby5jb20iLCJzY29wZSI6ImJsb29wIGJsZWVwIiwiYXVkIjoiaHR0cHM6Ly9vYXV0aDIuZ29vZ2xlYXBpcy5jb20vdG9rZW4iLCJleHAiOjY5MDAsImlhdCI6MzMwMH0=.RQWl/KelPs6bxk+r5gWFMXz8zwf6q8XoHsffkRAquonLbjIx2oZOqjtizHo0yY2/w1HuanRfR1rgfl6qMiRyxtoiMPt69e3oPrjqpuTxK0sg9MtGPvPGMS0SdvEVKAPOUrpnIuDhx7NvVIzNKV3YNRYUKynCQisDPHJvsno3pW3HRWT9K1PNh1ZtRVp1KLWWqSppK+TUh/cbzgljDT0KCCuxxvC8x2vv7HVjZOX2W7XJPdiDqWAUKgk1rez8iM7oupKu7ZK6T2iR/OFb6BfM10u/AXv0OoOOwhWcP5nr+UvTXmfZsbBb8mrQXyTGJMa/YUdbSi3R9x3MneaGlVMGRA==',
        })
        .reply(200, { access_token: 'refresh', expires_in: 3600 });

      const p4 = getBearer(this.arguments);
      const p5 = getBearer(this.arguments);

      assert.deepStrictEqual(await Promise.all([p4, p5]), [
        'refresh',
        'refresh',
      ]);

      refreshScope.done();
    });

    it('rejects all callers when requesting a token fails', async function () {
      const scope = nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(500, { error: { message: 'blooped the big one' } });

      const p1 = getBearer(this.arguments);
      const p2 = getBearer(this.arguments);
      const p3 = getBearer(this.arguments);

      for (const p of [p1, p2, p3]) {
        await assert.rejects(() => p, {
          name: 'ProtocolError',
          message: 'blooped the big one',
        });
      }

      scope.done();

      // Now try to get back on the rails with a successful fetch
      const retryScope = nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, { access_token: 'retry', expires_in: 3600 });

      assert.deepStrictEqual(await getBearer(this.arguments), 'retry');

      retryScope.done();
    });

    it('doesnt pad if expires_in is too low', async function () {
      const scope = nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, { access_token: 'token', expires_in: 5 });

      assert.deepStrictEqual(await getBearer(this.arguments), 'token');

      scope.done();

      // Now that the cache is warm, we can get the value without extra network
      // hops
      assert.deepStrictEqual(await getBearer(this.arguments), 'token');

      // Now let the token expire
      this.clock.tick(5 * 1000);

      const refreshScope = nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, { access_token: 'refresh', expires_in: 3600 });

      assert.deepStrictEqual(await getBearer(this.arguments), 'refresh');

      refreshScope.done();
    });
  });
});
