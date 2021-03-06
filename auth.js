const { createSign } = require('crypto');

const request = require('./request');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

// When requesting a token, we specify 60 minutes. When setting the local
// lifetime of a token, we specify 5 minutes less than the lifetime reported by
// the server (so we expect a local lifetime of 55 minutes). This simple
// mechanism ought to work us around a race that could occur if we used the same
// number for both values: our local lifetime check could pass, but still be
// rejected by Google's API if we're operating right around the expiry epoch.
//
const EXP_SECS = 60 * 60;
const EXP_PADDING_SECS = 60 * 5;

const toB64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const sign = (b, k) => createSign('RSA-SHA256').update(b).sign(k);

const HEADER = toB64({ alg: 'RS256', typ: 'JWT' });

const getJWT = ({ key, email, scopes }) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: email,
    scope: scopes.join(' '),
    aud: TOKEN_URL,
    exp: now + EXP_SECS,
    iat: now,
  };

  const unsigned = `${HEADER}.${toB64(payload)}`;
  return `${unsigned}.${sign(unsigned, key).toString('base64')}`;
};

const getBearer = async ({ bearerCache, key, email, scopes }) => {
  if (bearerCache.isWarm()) {
    return bearerCache.value();
  }

  if (bearerCache.isFetching()) {
    return bearerCache.wait();
  }

  bearerCache.setFetching();

  try {
    const res = await request({
      url: TOKEN_URL,
      method: 'POST',
      form: {
        grant_type: GRANT_TYPE,
        assertion: getJWT({ key, email, scopes }),
      },
    });

    // Ensure our lifetime, with padding, never goes below 0. If it does, fall
    // back to the lifetime reported by the server. We'll likely start seeing a
    // small number of auth failures. We always expect to be able to apply
    // padding.
    let lifetime = res.body.expires_in - EXP_PADDING_SECS;
    if (lifetime <= 0) {
      lifetime = res.body.expires_in;
    }

    bearerCache.setWarm(res.body.access_token, lifetime);
    return bearerCache.value();
  } catch (e) {
    bearerCache.setCold(e);
    throw e;
  }
};

module.exports = { getBearer };
