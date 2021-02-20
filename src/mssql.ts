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

    return this._moduleExports;
  }

  // global export function
  private _patchCreatePool() {
    return (originalConnectionPool: any) => {
      const thisPlugin = this;
      thisPlugin._logger.debug('MssqlPlugin#patch: patched mssql ConnectionPool');
      return function createPool(_config: string | mssql.config) {
        const pool = new originalConnectionPool(...arguments);
        
        shimmer.wrap(pool, 'request', thisPlugin._patchRequest(pool));
        /** 
        shimmer.wrap(
          pool,
          'getConnection',
          thisPlugin._patchGetConnection(pool)
        );*/

        return pool;
      };
    };
  }

  private _patchRequest(pool: mssql.ConnectionPool) {
    return (originalRequest: Function) => {
      const thisPlugin = this;
      thisPlugin._logger.debug(
        'MssqlPlugin#patch: patched mssql pool request'
      );
      return function Request() {
        const request: Request = originalRequest();
        return request;
      };
    };
  }

  protected unpatch(): void {
    this._enabled = false;
    //throw new Error('Method not implemented.');
  }
}

export const plugin = new MssqlPlugin(MssqlPlugin.COMPONENT);