const _request = require('request');

const { ProtocolError } = require('./errors');

/**
 * Light wrapper around request.js. Returns a Promise and handles a couple
 * Google-specific protocol interpretations.
 *
 * @param  {Object} options Forwarded to request.js
 * @return {Promise} resolves with the request.js response
 */
const request = async (options) =>
  new Promise((resolve, reject) => {
    _request(options, (err, res) => {
      if (err) {
        reject(err);
        return;
      }

      // Instead of using the `json` property in the request options, which
      // impacts both request and response behavior, simply parse the response
      // if it's declared to be JSON.
      if (
        res.headers['content-type'].startsWith('application/json') &&
        !options.json
      ) {
        res.body = JSON.parse(res.body);
      }

      if (res.body.error) {
        reject(
          new ProtocolError(res.body.error.message || 'API response error', res)
        );
        return;
      }

      resolve(res);
    });
  });

module.exports = request;
