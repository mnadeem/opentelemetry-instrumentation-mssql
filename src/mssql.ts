import type * as mssql from 'mssql';

import { VERSION } from './version';
import * as shimmer from 'shimmer';

import { BasePlugin } from '@opentelemetry/core';

export class MssqlPlugin extends BasePlugin <typeof mssql> {

  static readonly COMPONENT = 'mssql';

  private _enabled = false;

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
        console.log(arguments);
        return originalQuery.apply(request, arguments); 
      };
    };
  }

  protected unpatch(): void {
    this._enabled = false;
    //throw new Error('Method not implemented.');
  }
}

export const plugin = new MssqlPlugin(MssqlPlugin.COMPONENT);