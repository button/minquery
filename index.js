'use strict';

const crypto = require('crypto');
const request = require('google-oauth-jwt').requestWithJWT();

const SCOPES = [
  'https://www.googleapis.com/auth/bigquery',
  'https://www.googleapis.com/auth/bigquery.insertdata'
];

class MinQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    this.message = message;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
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
class ProtocolError extends ResponseError {
}

class MinQuery {

  constructor(keyFile, email, projectId ) {
    this.keyFile = keyFile;
    this.email = email;
    this.projectId = projectId;
  }

  _request(method, path, data) {
    const url = `https://www.googleapis.com/bigquery/v2/projects/${this.projectId}${path}`;

    const promise = new Promise((resolve, reject) => {
      request({
        method: method,
        body: data,
        json: true,
        url: url,
        jwt: {
          email: this.email,
          keyFile: this.keyFile,
          scopes: SCOPES
        }
      }, (err, res) => {
        if (!err && res && res.body.error) {
          err = new ProtocolError(res.body.error.message || 'API response error', res);
        }

        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
    return promise;
  }

  /**
   * Create a table, returning the response on success.
   *
   * Ref: https://cloud.google.com/bigquery/docs/reference/v2/tables/insert
   * Ref: https://cloud.google.com/bigquery/docs/reference/v2/tables#resource
   *
   * @param  {string} dataset                 dataset name
   * @param  {string} tableName               table name
   * @param  {object[]} fields                table schema
   * @param  {Date}   options.expirationDate  If set, a Date object specifying when
   *                                          the table should be expired.
   */
  createTable(dataset, tableName, fields, options) {
    options = options || {};

    const data = {
      schema: {
        fields: fields
      },
      tableReference: {
        projectId: this.projectId,
        datasetId: dataset,
        tableId: tableName
      }
    };

    if (options.expirationDate) {
      data.expirationTime = options.expirationDate.getTime();
    }

    if (options.timePartitioning) {
      data.timePartitioning = options.timePartitioning;
    }

    return this._request('POST', `/datasets/${dataset}/tables`, data);
  }

  /**
   * Insert one or more rows, returning the response on success.
   *
   * Ref: https://cloud.google.com/bigquery/docs/reference/v2/tabledata/insertAll
   *
   * @param  {string} dataset     dataset name
   * @param  {string} tableName   table name
   * @param  {object[]} rows      row data
   */
  insert(dataset, tableName, rows) {
    const rowData = rows.map((row) => {
      let insertId = crypto.randomBytes(16).toString('hex');
      return { insertId: insertId, json: row };
    });
    const data = {
      kind: 'bigquery#tableDataInsertAllRequest',
      skipInvalidRows: true,
      ignoreUnknownValues: true,
      rows: rowData
    };
    return this._request('POST', `/datasets/${dataset}/tables/${tableName}/insertAll`, data);
  }

}

module.exports = MinQuery;