'use strict';

const assert = require('assert');
const nock = require('nock');
const MinQuery = require('../index');

describe('minquery', () => {

  let nockBack;

  before(() => {
    nockBack = nock.back;

    nockBack.setMode('lockdown');
    nockBack.fixtures = __dirname + '/fixtures';
  });

  after(() => {
    nock.enableNetConnect();
  });

  describe('#constructor', () => {

    it('fails when key and keyFile are missing', () => {
      assert.throws(() => new MinQuery(),
        /Must specify `options.key` or `options.keyFile`/);
    });

    it('fails when both key and keyFile are given', () => {
      assert.throws(() => new MinQuery({
        key: 'fake-key',
        keyFile: 'fake-key-file.txt'
      }), /Specify only one of `options.key` or `options.keyFile`/);
    });

    it('fails when email is missing', () => {
      assert.throws(() => new MinQuery({
        key: 'fake-key',
        projectId: 'fake-project'
      }), /Must specify `options.email`/);
    });

    it('fails when projectId is missing', () => {
      assert.throws(() => new MinQuery({
        key: 'fake-key',
        email: 'fake-email'
      }), /Must specify `options.projectId`/);
    });

    it('succeeds when all required fields are given (key)', () => {
      new MinQuery({
        key: 'fake-key',
        email: 'fake-email',
        projectId: 'fake-project'
      });
    });

    it('succeeds when all required fields are given (keyFile)', () => {
      new MinQuery({
        keyFile: __dirname + '/fixtures/fake-key.pem',
        email: 'fake-email',
        projectId: 'fake-project'
      });
    });

  });

  describe('#createTable', () => {

    let client;

    const ignoreOauthNockOpts = {
      before: (scope) => {
        // Because google-oauth-jwt is going to create a unique request
        // body every time we test, patch nock to treat oauth-looking
        // requests as the literal body '*'. Fixtures have been patched to
        // match on that as well.
        scope.filteringRequestBody = (body) => {
          if (/grant_type=.*assertion=.*/.test(body)) {
            return '*';
          }
          return body;
        };
      }
    };

    beforeEach(() => {
      client = new MinQuery({
        keyFile: __dirname + '/fixtures/fake-key.pem',
        email: 'fake-user@staging.iam.gserviceaccount.com',
        projectId: 'fake-project'
      });
    });

    it('works for good request', (done) => {
      const schema = [
        {
          name: 'flavor',
          type: 'STRING',
          mode: 'REQUIRED',
          description: 'Ice cream flavor.'
        }
      ];

      nockBack('create-table-good.json', ignoreOauthNockOpts, (nockDone) => {
        client.createTable('staging', 'faketable', schema).then(() => {
          nockDone();
          done();
        }).catch((err) => {
          nockDone();
          done(err);
        });
      });
    });

  });

  describe('#insert', () => {

    let client;

    const ignoreOauthNockOpts = {
      before: (scope) => {
        // Because google-oauth-jwt is going to create a unique request
        // body every time we test, patch nock to treat oauth-looking
        // requests as the literal body '*'. Fixtures have been patched to
        // match on that as well.
        scope.filteringRequestBody = (body) => {
          if (/grant_type=.*assertion=.*/.test(body)) {
            return '*';
          }
          return body;
        };
      }
    };

    beforeEach(() => {
      client = new MinQuery({
        keyFile: __dirname + '/../mikey-test-02.pem',
        email: 'mikey-test-02@fake-project.iam.gserviceaccount.com',
        projectId: 'fake-project'
      });
    });

    it('for all good rows', (done) => {
      nockBack('insert-good.json', ignoreOauthNockOpts, (nockDone) => {
        const rows = [
          { flavor: 'mint' },
          { flavor: 'bubblegum' },
          { flavor: 'eggplant' }
        ];

        client.insert('staging', 'faketable', rows).then((response) => {
          nockDone();
          assert.deepEqual(response.body,
            { kind: 'bigquery#tableDataInsertAllResponse' });
          done();
        }).catch((err) => {
          nockDone();
          done(err);
        });
      });
    });

    it('with invalid row when ignored', (done) => {
      nockBack('insert-invalid-row-ignored.json', ignoreOauthNockOpts, (nockDone) => {
        const rows = [
          { flavor: 'mint' },
          { flavor: 'bubblegum' },
          { topping: 'eggplant' }
        ];

        const options = {
          skipInvalidRows: true
        };

        client.insert('staging', 'faketable', rows, options).then(() => {
          nockDone();
          done();
        }).catch((err) => {
          nockDone();
          done(err);
        });
      });
    });

    it('with invalid row when not ignored', (done) => {
      nockBack('insert-invalid-row-rejected.json', ignoreOauthNockOpts, (nockDone) => {
        const rows = [
          { flavor: 'mint' },
          { flavor: 'bubblegum' },
          { topping: 'eggplant' }
        ];

        const options = {
          skipInvalidRows: false
        };

        client.insert('staging', 'faketable', rows, options).then(() => {
          nockDone();
          done();
        }).catch((err) => {
          nockDone();
          done(err);
        });
      });
    });

    it('with invalid value when ignored', (done) => {
      nockBack('insert-invalid-value-ignored.json', ignoreOauthNockOpts, (nockDone) => {
        const rows = [
          { flavor: 'mint' },
          { flavor: 'bubblegum' },
          { flavor: 'eggplant', topping: 'cilantro' }
        ];

        const options = {
          ignoreUnknownValues: true
        };

        client.insert('staging', 'faketable', rows, options).then(() => {
          nockDone();
          done();
        }).catch((err) => {
          nockDone();
          done(err);
        });
      });
    });

    it('with invalid value when not ignored', (done) => {
      nockBack('insert-invalid-value-rejected.json', ignoreOauthNockOpts, (nockDone) => {
        const rows = [
          { flavor: 'mint' },
          { flavor: 'bubblegum' },
          { flavor: 'eggplant', topping: 'cilantro' }
        ];

        const options = {
          ignoreUnknownValues: false
        };

        client.insert('staging', 'faketable', rows, options).then(() => {
          nockDone();
          done();
        }).catch((err) => {
          nockDone();
          done(err);
        });
      });
    });

  });

});