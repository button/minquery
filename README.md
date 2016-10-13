# Minquery

Minimumal BigQuery client for NodeJS. No native dependencies. ES6.

## Overview

This is a "minimal" client library for the BigQuery API. In contrast to the [official Google Cloud client library](https://github.com/GoogleCloudPlatform/google-cloud-node#google-bigquery), it does very little - and has very few dependencies.

**Supported:**

* Create a table.
* Insert row(s).

**Not supported:**

* Everything else.

## Usage

```js
const MinQuery = require('minquery');
const client = new MinQuery({
  keyFile: 'some-file.pem',
  email: 'some-account@fake-project.iam.gserviceaccount.com',
  projectId: 'some-project'
});

// Create a table.
const schema = [
  {
    name: 'flavor',
    type: 'STRING',
    mode: 'REQUIRED',
    description: 'Ice cream flavor.'
  }
];

client.createTable('dataset', 'tablename', schema).then(() => {
  console.log('Yay, table created!');
}).catch(console.log);

// Insert some data.
const rows = [
  { flavor: 'mint' },
  { flavor: 'bubblegum' }
];

client.insert('dataset', 'tablename', rows).then((response) => {
  console.log(response.body);
}).catch(console.log);
```

## License and Copyright

Licensed under the MIT license. See `LICENSE.txt` for full terms.

Copyright 2016 Button, Inc.
