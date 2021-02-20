import type * as mssqlTypes from 'mssql';
import { VERSION } from './version';

import { BasePlugin } from '@opentelemetry/core';

export class MssqlPlugin extends BasePlugin<typeof mssqlTypes> {
  protected patch(): typeof mssqlTypes {
    throw new Error('Method not implemented.');
  }
  
  constructor(readonly moduleName: string) {
    super('opentelemetry-plugin-mssql', VERSION);
  }

  protected unpatch(): void {
      throw new Error('Method not implemented.');
  }
}


