import { context, setSpan } from '@opentelemetry/api';

import { NodeTracerProvider } from '@opentelemetry/node';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/tracing';

import { MssqlInstrumentation } from '../src';

//const logger = new NoopLogger();
const instrumentation = new MssqlInstrumentation({});
import * as assert from 'assert';
import * as Docker from './Docker';
import * as mssql from 'mssql';

const config: mssql.config = {
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'P@ssw0rd',
  server: process.env.MSSQL_HOST || 'localhost',  
  database: process.env.MSSQL_DATABASE || 'tempdb',
  port: 1433,
  options: {
    enableArithAbort: true,
    encrypt: false
  }
};

describe('mssql@6.x', () => {

  const testMssql = process.env.RUN_MSSQL_TESTS || true; // For CI: assumes local mysql db is already available
  const testMssqlLocally = process.env.RUN_MSSQL_TESTS_LOCAL; // For local: spins up local mysql db via docker
  const shouldTest = testMssql || testMssqlLocally; // Skips these tests if false (default)

  let contextManager: AsyncHooksContextManager;

  const provider = new NodeTracerProvider();
  const memoryExporter = new InMemorySpanExporter();
  let pool: mssql.ConnectionPool;

  before(function (done) {
      if (!shouldTest) {
        // this.skip() workaround
        // https://github.com/mochajs/mocha/issues/2683#issuecomment-375629901
        this.test!.parent!.pending = true;
        console.log('Skipping tests...');
        this.skip();
      }
      instrumentation.setTracerProvider(provider);
      provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
      if (testMssqlLocally) {
        console.log('Starting mssql...');
        Docker.start('mssql');
        // wait 15 seconds for docker container to start
        this.timeout(20000);
        setTimeout(done, 15000);
      } else {
        done();
      }
  });

  after(function () {

    if (testMssqlLocally) {
      this.timeout(5000);
      console.log('Stopping mssql...');
      Docker.cleanUp('mssql');
    }
  });

  beforeEach(async () => {

      contextManager = new AsyncHooksContextManager();
      context.setGlobalContextManager(contextManager.enable());
      instrumentation.enable();
      
      //start pool        
      pool = new mssql.ConnectionPool(config, (err) => {
        if (err) {
          console.debug("SQL Connection Establishment ERROR: %s", err);
        } else {
          console.debug('SQL Connection established...');
        }
      });
      await pool.connect()
      pool.on('error', err => {
        console.log(" err " + err);
      });
      
    });
  
    afterEach(done => {
      memoryExporter.reset();
      contextManager.disable();
      instrumentation.disable();

      // end pool
      pool.close().finally(() => {
        done();
      });        
    });

    it('should export a plugin', () => {
      assert(instrumentation instanceof MssqlInstrumentation);
    });
  
    it('should have correct moduleName', () => {
      assert.strictEqual(instrumentation.instrumentationName, 'opentelemetry-instrumentation-mssql');
    });
    
    describe('when the query is a string', () => {
      it('should name the span accordingly ', done => {

        pool.connect().then((result) => {

          const span = provider.getTracer('default').startSpan('test span');
          context.with(setSpan(context.active(), span), () => {
            const request = new mssql.Request(pool);
            request.query('SELECT 1 as number').then((result) => {
              //console.log(result);
            }).catch(error =>{
              //console.log("child erro " + error);
            }).finally(() => {
              const spans = memoryExporter.getFinishedSpans();
              assert.strictEqual(spans[0].name, 'SELECT');
              done();
            });

          });
        })

      });
    });

    describe('when connectionString is provided', () => {
      it('should name the span accordingly ', done => {
        
        try {
          const pool = new mssql.ConnectionPool(`mssql://${config.user}:${config.password}@${config.server}/${config.database}`)
          //pool.query`select * from mytable where id = ${value}`;
          pool.connect().then(async () => {
            const request = new mssql.Request(pool);
            request.query(`SELECT 1 as number`).then((result) => {
              const spans = memoryExporter.getFinishedSpans();
              assert.strictEqual(spans[0].name, 'SELECT');
            }).catch(error =>{
              //console.log("child erro " + error);
            }).finally(() => {
              pool.close();
              done();
            });
          })
        } catch (err) {
          console.error(err);
        }
      });
    });

    describe('when connectionString is provided for query on pool', () => {
      it('should name the span accordingly ', async () => {          

          const pool = new mssql.ConnectionPool(`mssql://${config.user}:${config.password}@${config.server}/${config.database}`)
          
          await pool.connect();
          await pool.query`SELECT 1 as number`;
          const spans = memoryExporter.getFinishedSpans();
          assert.strictEqual(spans[0].name, 'SELECT');
          pool.close();
      });
    });

});