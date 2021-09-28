const assert = require('assert');
const nock = require('nock');

const request = require('../request');

describe('request', function () {
  beforeEach(function () {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  afterEach(function () {
    nock.enableNetConnect();
    nock.cleanAll();
  });

  it('makes a network request and returns a promise', async function () {
    const scope = nock('https://localhost')
      .post('/bloop')
      .reply(200, { status: 'ok' });

    const res = await request({
      url: 'https://localhost/bloop',
      method: 'post',
    });

    assert.deepStrictEqual(res.body, { status: 'ok' });
    scope.done();
  });

  it('doesnt parse a JSON response body if handled by request.js', async function () {
    const scope = nock('https://localhost')
      .post('/bloop')
      .reply(200, { status: 'ok' });

    const res = await request({
      url: 'https://localhost/bloop',
      method: 'post',
      json: true,
    });

    assert.deepStrictEqual(res.body, { status: 'ok' });
    scope.done();
  });

  it('rejects with networking-level errors', async function () {
    const scope = nock('https://localhost')
      .post('/bloop')
      .replyWithError('blooped the big one');

    await assert.rejects(
      () => request({ url: 'https://localhost/bloop', method: 'post' }),
      {
        name: 'Error',
        message: 'blooped the big one',
      }
    );

    scope.done();
  });

  it('resolves with http-level errors', async function () {
    const scope = nock('https://localhost')
      .post('/bloop')
      .reply(500, { status: 'error' });

    const res = await request({
      url: 'https://localhost/bloop',
      method: 'post',
    });

    assert.deepStrictEqual(res.body, { status: 'error' });
    scope.done();
  });

  it('rejects with protocol-level errors', async function () {
    const scope = nock('https://localhost')
      .post('/bloop')
      .reply(500, { error: { message: 'blooped the big one' } });

    await assert.rejects(
      () => request({ url: 'https://localhost/bloop', method: 'post' }),
      {
        name: 'ProtocolError',
        message: 'blooped the big one',
      }
    );

    scope.done();
  });

  it('rejects with invalid JSON responses', async function () {
    const scope = nock('https://localhost')
      .post('/bloop')
      .reply(200, '{ "bad": json }', { 'Content-Type': 'application/json' });

    await assert.rejects(
      () => request({ url: 'https://localhost/bloop', method: 'post' }),
      {
        name: 'ProtocolError',
        message: 'Unexpected token j in JSON at position 9',
      }
    );

    scope.done();
  });

  it('gracefully handles empty json responses', async function () {
    const scope = nock('https://localhost')
      .post('/bloop', { bloop: true })
      .reply(200);

    const res = await request({
      url: 'https://localhost/bloop',
      json: true,
      body: { bloop: true },
      method: 'post',
    });

    assert.deepStrictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body, undefined);

    scope.done();
  });
});
