# OpenTelemetry mssql Instrumentation for Node.js

This module provides automatic instrumentation for [mssql](https://www.npmjs.com/package/mssql)

## Installation

````
npm install --save opentelemetry-plugin-mssql
````

## Usage

````
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