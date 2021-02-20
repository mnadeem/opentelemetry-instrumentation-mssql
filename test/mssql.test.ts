import { NoopLogger, StatusCode, context, setSpan } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/node';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import {
    InMemorySpanExporter,
    ReadableSpan,
    SimpleSpanProcessor,
} from '@opentelemetry/tracing';
import {
    DatabaseAttribute,
    GeneralAttribute,
} from '@opentelemetry/semantic-conventions';

import * as assert from 'assert';
import * as mssql from 'mssql';
import { MssqlPlugin, plugin } from '../src/mssql';

const port = Number(process.env.MSSQL_PORT) || 33306;
const database = process.env.MSSQL_DATABASE || 'test_db';
const host = process.env.MSSQL_HOST || '127.0.0.1';
const user = process.env.MSSQL_USER || 'otel';
const password = process.env.MSSQL_PASSWORD || 'secret';

describe('mssql@6.x', () => {
    let contextManager: AsyncHooksContextManager;
    let pool: mssql.ConnectionPool;
    const provider = new NodeTracerProvider({ plugins: {} });
    const logger = new NoopLogger();
    const memoryExporter = new InMemorySpanExporter();

    before(function (done) {
        provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
        done();
    });

    after(function () {

    });

    beforeEach(() => {
        contextManager = new AsyncHooksContextManager().enable();
        context.setGlobalContextManager(contextManager);
        plugin.enable(mssql, provider, logger);

        //start pool        
      });
    
      afterEach(done => {
        context.disable();
        memoryExporter.reset();
        plugin.disable();
        // end pool
        done();
      });

      it('should export a plugin', () => {
        assert(plugin instanceof MssqlPlugin);
      });
    
      it('should have correct moduleName', () => {
        assert.strictEqual(plugin.moduleName, 'mssql');
      });
});