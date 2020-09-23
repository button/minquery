const _request = require('request');

const { ProtocolError } = require('./errors');

const request = async (options) =>
  new Promise((resolve, reject) => {
    _request(options, (err, res) => {
      if (err) {
        reject(err);
      }

      if (
        res.headers['content-type'].startsWith('application/json;') &&
        typeof res.body === 'string'
      ) {
        res.body = JSON.parse(res.body);
      }

      if (res && res.body.error) {
        reject(
          new ProtocolError(res.body.error.message || 'API response error', res)
        );
      }

      resolve(res);
    });
  });

module.exports = request;
