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

      const contentType = res.headers['content-type'];

      // If options.json=true, then request.js will automatically parse response
      // bodies as JSON. Some calls may not be able to pass options.json=true
      // (for example, if the request body is not JSON), but may still receive
      // a JSON response. Accordingly, this condition attempts to parse a JSON
      // response, but only if it wasn't already parsed by request.js.
      if (
        contentType && contentType.startsWith('application/json') &&
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
