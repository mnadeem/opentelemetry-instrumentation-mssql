import { NoopLogger, context } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/node';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import {
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/tracing';

import * as assert from 'assert';
import * as mssql from 'mssql';


import { MssqlPlugin, plugin } from '../src/mssql';
import { request } from 'http';

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
  server: process.env.MSSQL_HOST || 'localhost',  
  database: process.env.MSSQL_DATABASE || 'tempdb',
  port: Number(process.env.MSSQL_PORT) || 1433,
  options: {
    enableArithAbort: true,
    encrypt: false
  }
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

          //const pool = new mssql.ConnectionPool(config);
          //const poolConnect = pool.connect();

          const pool = new mssql.ConnectionPool(config, (err) => {
            if (err) {
                logger.error("SQL Connection Establishment ERROR: %s", err);
            } else {
                logger.debug('SQL Connection established...');
            }
        });
        
          pool.on('error', err => {
            console.log(" err " + err);
          });
          const request = new mssql.Request(pool);
          request.query('select 1 as number').then((result) => {
            console.log(" result " + result);
          }).catch(err => {              
            console.log(err);
          });          
          done();
        });

      });
    
});