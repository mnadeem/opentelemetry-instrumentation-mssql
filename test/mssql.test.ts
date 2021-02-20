import { NoopLogger, context } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/node';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import {
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/tracing';


import * as assert from 'assert';
import * as mssql from 'mssql';
import ConnectionPool from 'mssql';


import { MssqlPlugin, plugin } from '../src/mssql';

/** 
const port = process.env.MSSQL_PORT || 1433;
const database = process.env.MSSQL_DATABASE || 'tempdb';
const server = process.env.MSSQL_HOST || '127.0.0.1';  
const user = process.env.MSSQL_USER || 'sa';
const password = process.env.MSSQL_PASSWORD || 'P@ssw0rd';
*/

const config: mssql.config = {
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'P@ssw0rd',
  server: process.env.MSSQL_HOST || '127.0.0.1',  
  database: process.env.MSSQL_DATABASE || 'tempdb',
  port: Number(process.env.MSSQL_PORT) || 1433
};

describe('mssql@6.x', () => {
    let contextManager: AsyncHooksContextManager;

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

      describe('when the query is a string', () => {

        it('should name the span accordingly ', done => {

          const pool = new mssql.ConnectionPool(config);
          console.log(pool);

          done();

        });

      });
    
});