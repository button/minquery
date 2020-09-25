const fs = require('fs');

const request = require('./request');
const { getBearer } = require('./auth');
const BearerCache = require('./bearer-cache');

const SCOPES = [
  'https://www.googleapis.com/auth/bigquery',
  'https://www.googleapis.com/auth/bigquery.insertdata',
];

class MinQuery {

  /**
   * Constructor.
   *
   * @param  {string} options.key       A PEM-encoded private key to authenticate
   *                                    to the BigQuery API. Must be specified if
   *                                   `options.keyFile` is not specified.
   * @param  {string} options.keyFile   Path to a PEM-encoded private key,
   *                                    which will be read synchronously in
   *                                    the constructor. Must be specified if
   *                                    `options.key` is not specified.
   * @param  {string} options.email     Google auth e-mail address. Required.
   * @param  {string} options.projectId Google cloud project ID. Required.
   */
  constructor(options) {
    options = options || {};

    if (!options.key && !options.keyFile) {
      throw new Error('Must specify `options.key` or `options.keyFile`');
    } else if (options.key && options.keyFile) {
      throw new Error('Specify only one of `options.key` or `options.keyFile`');
    }

    if (!options.email) {
      throw new Error('Must specify `options.email`');
    }
    if (!options.projectId) {
      throw new Error('Must specify `options.projectId`');
    }

    if (options.keyFile) {
      this.key = fs.readFileSync(options.keyFile);
    } else {
      this.key = options.key;
    }

    this.email = options.email;
    this.projectId = options.projectId;
    this.bearerCache = new BearerCache();
  }

  async _request(method, path, data) {
    const url = `https://www.googleapis.com/bigquery/v2/projects/${this.projectId}${path}`;

    const bearer = await getBearer({
      bearerCache: this.bearerCache,
      key: this.key,
      email: this.email,
      scopes: SCOPES,
    });

    return request({
      method,
      body: data,
      json: true,
      url,
      auth: { bearer },
    });
  }

  /**
   * Create a table, returning the response on success.
   *
   * Ref: https://cloud.google.com/bigquery/docs/reference/v2/tables/insert
   * Ref: https://cloud.google.com/bigquery/docs/reference/v2/tables#resource
   *
   * @param  {string} dataset                  dataset name
   * @param  {string} tableName                table name
   * @param  {object[]} fields                 table schema
   * @param  {Date}   options.expirationDate   If set, a Date object specifying when
   *                                           the table should be expired.
   * @param  {object} options.timePartitioning If set, an object containing fields
   *                                           `expirationMs` and `type` which will be
   *                                           passed through to the BigQuery API.
   */
  createTable(dataset, tableName, fields, options) {
    options = options || {};

    const data = {
      schema: {
        fields,
      },
      tableReference: {
        projectId: this.projectId,
        datasetId: dataset,
        tableId: tableName,
      },
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
   * @param  {string}   dataset                     dataset name
   * @param  {string}   tableName                   table name
   * @param  {object[]} rows                        row data
   * @param  {boolean}  options.skipInvalidRows     Passed through to BigQuery API:
   *                                                Don't fail the whole request if a
   *                                                row is invalid (default true).
   * @param  {boolean}  options.ignoreUnknownValues Passed through to BigQuery API:
   *                                                Don't fail the whole request if a
   *                                                row is invalid (default true).
   * @param  {boolean}  options.addInsertId         Add a random insert id to each
   */
  insert(dataset, tableName, rows, options) {
    options = options || {};

    const rowData = rows.map((row) => {
      return { json: row };
    });

    const data = {
      kind: 'bigquery#tableDataInsertAllRequest',
      skipInvalidRows: options.skipInvalidRows !== undefined ?
        !!options.skipInvalidRows : true,
      ignoreUnknownValues: options.ignoreUnknownValues !== undefined ?
        !!options.ignoreUnknownValues : true,
      rows: rowData,
    };
    return this._request('POST', `/datasets/${dataset}/tables/${tableName}/insertAll`, data);
  }

}

module.exports = MinQuery;
