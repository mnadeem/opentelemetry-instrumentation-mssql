import type * as mssql from 'mssql';

import { VERSION } from './version';
import * as shimmer from 'shimmer';

import { BasePlugin } from '@opentelemetry/core';

export class MssqlPlugin extends BasePlugin <typeof mssql> {

  static readonly COMPONENT = 'mssql';

  //private _enabled = false;

  constructor(readonly moduleName: string) {
    super('opentelemetry-plugin-mssql', VERSION);
  }

  protected patch(): typeof mssql {
    //this._enabled = true;

    shimmer.wrap(
      this._moduleExports,
      'ConnectionPool',
      this._patchCreatePool() as any
    );

    return this._moduleExports;
  }

  // global export function
  private _patchCreatePool() {
    return (originalCreatePool: any) => {
      const thisPlugin = this;
      thisPlugin._logger.debug('MssqlPlugin#patch: patched mysql createPool');
      return function createPool(_config: mssql.ConnectionPool) {
        const pool = new originalCreatePool(...arguments);
        console.log(arguments);

        /** 
        shimmer.wrap(pool, 'query', thisPlugin._patchQuery(pool));
        shimmer.wrap(
          pool,
          'getConnection',
          thisPlugin._patchGetConnection(pool)
        );
      */
        return pool;
      };
    };
  }

  protected unpatch(): void {
    //throw new Error('Method not implemented.');
  }
}

export const plugin = new MssqlPlugin(MssqlPlugin.COMPONENT);