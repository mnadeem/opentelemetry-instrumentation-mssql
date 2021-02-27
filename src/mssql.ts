import type * as mssql from 'mssql';

import { VERSION } from './version';
import * as shimmer from 'shimmer';

import { BasePlugin } from '@opentelemetry/core';
import { SpanStatusCode, SpanKind, diag} from '@opentelemetry/api';
import { DatabaseAttribute } from '@opentelemetry/semantic-conventions';
import { getConnectionAttributes, getSpanName } from './Spans';

export class MssqlPlugin extends BasePlugin <typeof mssql> {

  static readonly COMPONENT = 'mssql';
  static readonly COMMON_ATTRIBUTES = {
    [DatabaseAttribute.DB_SYSTEM]: MssqlPlugin.COMPONENT,
  };

  constructor(readonly moduleName: string) {
    super('opentelemetry-plugin-mssql', VERSION);
  }

  protected patch(): typeof mssql {

    shimmer.wrap(
      this._moduleExports,
      'ConnectionPool',
      this._patchCreatePool() as any
    );

    shimmer.wrap(
      this._moduleExports,
      'Request',
      this._patchRequest() as any
    );

    return this._moduleExports;
  }

  // global export function
  private _patchCreatePool() {
    return (originalConnectionPool: any) => {
      const thisPlugin = this;
      diag.debug('MssqlPlugin#patch: patching mssql ConnectionPool');
      return function createPool(_config: string | mssql.config) {

        const pool = new originalConnectionPool(...arguments);
        shimmer.wrap(pool, 'query', thisPlugin._patchPoolQuery(pool));
        return pool;
      };
    };
  }

  private _patchPoolQuery(pool: mssql.ConnectionPool) {
    return (originalQuery: Function) => {
      const thisPlugin = this;
      diag.debug(
        'MssqlPlugin#patch: patching mssql pool request'
      );
      return function request() {
        const args = arguments[0];
        const span = thisPlugin._tracer.startSpan(getSpanName(args[0]), {
          kind: SpanKind.CLIENT
        });
        return originalQuery.apply(pool, arguments)    
        .catch((error: { message: any; }) => {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          })
        }).finally(() => {         
          span.end();         
        });
        
      };
    };
  }

  private _patchRequest() {
    return (originalRequest: any) => {
      const thisPlugin = this;
      diag.debug(
        'MssqlPlugin#patch: patching mssql pool request'
      );
      return function request() {
        const request: mssql.Request = new originalRequest(...arguments);
        shimmer.wrap(request, 'query', thisPlugin._patchQuery(request));
        return request;
      };
    };
  }

  private _patchQuery(request: mssql.Request) {
    return (originalQuery: Function) => {
      const thisPlugin = this;
      diag.debug(
        'MssqlPlugin#patch: patching mssql request query'
      );
      return function query(command: string | TemplateStringsArray): Promise<mssql.IResult<any>> {
        const span = thisPlugin._tracer.startSpan(getSpanName(command), {
          kind: SpanKind.CLIENT,
          attributes: {
            ...MssqlPlugin.COMMON_ATTRIBUTES,
            ...getConnectionAttributes((<any>request).parent!.config)
          },
        });
        var interpolated = thisPlugin.formatDbStatement(command)
        for (const property in request.parameters) {
          interpolated = interpolated.replace(`@${property}`, `${(request.parameters[property].value)}`);
        }
        span.setAttribute(DatabaseAttribute.DB_STATEMENT, interpolated);

        const result = originalQuery.apply(request, arguments); 

        result        
        .catch((error: { message: any; }) => {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          })
        }).finally(() => {         
          span.end()
        });

        return result; 
      };
    };
  }

  private formatDbStatement(command: string | TemplateStringsArray) {
    if (typeof command === 'object') {
      return command[0];
    }
    return command;
  }

  protected unpatch(): void {
    shimmer.unwrap(this._moduleExports, 'ConnectionPool');
    shimmer.unwrap(this._moduleExports, 'Request');
  }

}

export const plugin = new MssqlPlugin(MssqlPlugin.COMPONENT);