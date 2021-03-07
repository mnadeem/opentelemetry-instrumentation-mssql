# OpenTelemetry mssql Instrumentation for Node.js

This module provides automatic instrumentation for [mssql](https://www.npmjs.com/package/mssql)

There are :two: variations 

# Instrumention Variation

This is the **recomended variation**. The source code can be found [here](https://github.com/mnadeem/opentelemetry-instrumentation-mssql/tree/instrumentation)


## Installation

````bash
npm install --save opentelemetry-instrumentation-mssql
````

## Usage

````js
const { NodeTracerProvider } = require('@opentelemetry/node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { MssqlInstrumentation } = require('opentelemetry-instrumentation-mssql');

const traceProvider = new NodeTracerProvider({
  // be sure to disable old plugin
  plugins: {
    mssql: { enabled: false, path: 'opentelemetry-plugin-mssql' }
  }
});

registerInstrumentations({
  traceProvider,
  instrumentations: [
    new MssqlInstrumentation({
      // see under for available configuration
    })
  ]
});

````

### MSSQL Instrumentation Options

MSSQL instrumentation has few options available to choose from. You can set the following:

| Options       | Type                       | Description                                                                               |
| --------------| ---------------------------| ----------------------------------------------------------------------------------------- |
| `ignoreOrphanedSpans` | `boolean` | Set to true if you only want to trace operation which has parent spans |


## Versions

| Instrumentation Version       | OTEL Version                       |
| --------------| ---------------------------|
| `0.0.1` | `0.15.0` |
| `0.1.0` | `0.16.0` |
| `0.2.0` | `0.17.0` |
| `0.3.0` | `0.18.0` |

# Plugin Variation

This variation would be **depreciated soon**. The source code can be found [here](https://github.com/mnadeem/opentelemetry-instrumentation-mssql/tree/plugin)

## Installation

````bash
npm install --save opentelemetry-plugin-mssql
````

## Usage

````js
import {LogLevel} from '@opentelemetry/core'
import {NodeTracerProvider} from '@opentelemetry/node'
import {registerInstrumentations} from '@opentelemetry/instrumentation'

// Enable OpenTelemetry exporters to export traces to Grafan Tempo.
const provider = new NodeTracerProvider ({
    plugins: {
        mssql: {
            enabled: true,
            // You may use a package name or absolute path to the file.
            path: "opentelemetry-plugin-mssql",
        },
    },
    logLevel: LogLevel.ERROR,      
});

registerInstrumentations({
    tracerProvider: provider
});
````

## Versions

| Plugin Version | OTEL Version            |
| ------------| ---------------------------|
| `0.1.0` | `0.15.0` |
| `0.2.0` | `0.16.0` |
| `0.3.0` | `0.17.0` |

# Sample Trace

![](docs/img/mssql-trace.png)

# Instrumentation

**Supported**

* `Request.query`
* `ConnectionPool.query`

**Future**

* `Request.execute`
* `Request.batch`
* `Request.bulk`
* `ConnectionPool.batch`

# Misc

Start mssql server as follows (*for development*)

````bash
docker run  -p 1433:1433 -d -e ACCEPT_EULA=Y --name otmssql -e SA_PASSWORD=P@ssw0rd mcr.microsoft.com/mssql/server
````