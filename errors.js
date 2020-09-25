/** Base error class. */
class MinQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    this.message = message;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }
}

/** Any sort of response error. */
class ResponseError extends MinQueryError {
  constructor(message, response) {
    super(message);
    this.response = response;
  }
}

/** Bigquery API returned an error. */
class ProtocolError extends ResponseError {}

module.exports = {
  MinQueryError,
  ResponseError,
  ProtocolError,
};
