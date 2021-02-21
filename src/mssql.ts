import type * as mssql from 'mssql';

import { VERSION } from './version';
import * as shimmer from 'shimmer';

import { BasePlugin } from '@opentelemetry/core';
import { StatusCode, SpanKind } from '@opentelemetry/api';
import { DatabaseAttribute } from '@opentelemetry/semantic-conventions';
import { getConnectionAttributes, getSpanName } from './Spans';

export class MssqlPlugin extends BasePlugin <typeof mssql> {

  static readonly COMPONENT = 'mssql';
  static readonly COMMON_ATTRIBUTES = {
    [DatabaseAttribute.DB_SYSTEM]: MssqlPlugin.COMPONENT,
  };

  private _enabled = false;
  private mssqlConfig: mssql.config = null;

  constructor(readonly moduleName: string) {
    super('opentelemetry-plugin-mssql', VERSION);
  }

  protected patch(): typeof mssql {
    this._enabled = true;

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
      thisPlugin._logger.debug('MssqlPlugin#patch: patched mssql ConnectionPool');
      return function createPool(_config: string | mssql.config) {

        if (typeof _config === 'object') {
          thisPlugin.mssqlConfig = _config;
        }
        
        const pool = new originalConnectionPool(...arguments);
        //shimmer.wrap(pool, 'request', thisPlugin._patchRequest());
        return pool;
      };
    };
  }

  private _patchRequest() {
    return (originalRequest: any) => {
      const thisPlugin = this;
      thisPlugin._logger.debug(
        'MssqlPlugin#patch: patched mssql pool request'
      );
      return function request() {
        const request: mssql.Request = new originalRequest(...arguments);
        //console.log(arguments);
        shimmer.wrap(request, 'query', thisPlugin._patchQuery(request));
        return request;
      };
    };
  }

  private _patchQuery(request: mssql.Request) {
    return (originalQuery: Function) => {
      const thisPlugin = this;
      thisPlugin._logger.debug(
        'MssqlPlugin#patch: patched mssql request query'
      );
      return function query(command: string | TemplateStringsArray): Promise<mssql.IResult<any>> {
        //const query: Promise<mssql.IResult<any>> = originalQuery(command);
        //console.log(arguments);
        //console.log(thisPlugin.mssqlConfig);
        const span = thisPlugin._tracer.startSpan(getSpanName(command), {
          kind: SpanKind.CLIENT,
          attributes: {
            ...MssqlPlugin.COMMON_ATTRIBUTES,
            ...getConnectionAttributes(thisPlugin.mssqlConfig)
          },
        });

        span.setAttribute(DatabaseAttribute.DB_STATEMENT, thisPlugin.format(command));

        const result = originalQuery.apply(request, arguments); 

        result        
        .catch((error: { message: any; }) => {
          span.setStatus({
            code: StatusCode.ERROR,
            message: error.message,
          })
        }).finally(() => {         
          span.end()
        });

        return result; 
      };
    };
  }

  private format(command: string | TemplateStringsArray) {
    if (typeof command === 'object') {
      return command[0];
    }
    return command;
  }

  protected unpatch(): void {
    this._enabled = false;
    shimmer.unwrap(this._moduleExports, 'ConnectionPool');
    shimmer.unwrap(this._moduleExports, 'Request');
  }
}

export const plugin = new MssqlPlugin(MssqlPlugin.COMPONENT);