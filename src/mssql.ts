import type * as mssql from 'mssql';

import { DatabaseAttribute } from '@opentelemetry/semantic-conventions';
import {
    InstrumentationBase,
    InstrumentationConfig,
    InstrumentationModuleDefinition,
    InstrumentationNodeModuleDefinition,
    isWrapped
} from '@opentelemetry/instrumentation';

import {
    SpanKind,
    StatusCode,
    getSpan, 
    context  
} from '@opentelemetry/api';

import { MssqlInstrumentationConfig } from './types';
import { getConnectionAttributes, getSpanName } from './Spans';
import { VERSION } from './version';

type Config = InstrumentationConfig & MssqlInstrumentationConfig;

export class MssqlInstrumentation extends InstrumentationBase<typeof mssql> {

    static readonly COMPONENT = 'mssql';
    static readonly COMMON_ATTRIBUTES = {
        [DatabaseAttribute.DB_SYSTEM]: MssqlInstrumentation.COMPONENT,
    };

    protected _config!: Config;
    private mssqlConfig: mssql.config = {user: "", password: "", server: ""};

    constructor(config: Config = {}) {
        super('opentelemetry-instrumentation-mssql', VERSION, Object.assign({}, config));
    }

    setConfig(config: Config = {}) {
        this._config = Object.assign({}, config);
        if (config.logger) this._logger = config.logger;
    }

    protected init(): void | InstrumentationModuleDefinition<typeof mssql> | InstrumentationModuleDefinition<typeof mssql>[] {
        const module = new InstrumentationNodeModuleDefinition<typeof mssql>(
            MssqlInstrumentation.COMPONENT,
            ['*'],
            this.patch.bind(this),
            this.unpatch.bind(this)
        );
        return module;
    }

    protected patch(moduleExports: typeof mssql) {
        if (moduleExports === undefined || moduleExports === null) {
            return moduleExports;
        }

        this._logger.debug(`applying patch to ${MssqlInstrumentation.COMPONENT}`);
        this.unpatch(moduleExports);
        this._wrap(moduleExports, 'ConnectionPool', this._createConnectionPoolPatch.bind(this) as any);
        this._wrap(moduleExports, 'Request', this._createRequestPatch.bind(this) as any);

        return moduleExports;
    }

    private _createConnectionPoolPatch() {
        return (original: any) => {
            const thisInstrumentation = this;
            thisInstrumentation._logger.debug('MssqlPlugin#patch: patching mssql ConnectionPool');
            return function createPool(_config: string | mssql.config) {
                if (thisInstrumentation._config?.ignoreOrphanedSpans && !getSpan(context.active())) {
                    return original.apply(thisInstrumentation, arguments);
                }    

                if (typeof _config === 'object') {
                    thisInstrumentation.mssqlConfig = _config;
                }
                const pool = new original(...arguments);          
                return pool;
            };
        };
    }

    private _createRequestPatch() {
        return (originalRequest: any) => {
            const thisPlugin = this;
            thisPlugin._logger.debug(
                'MssqlPlugin#patch: patching mssql pool request'
            );
            return function request() {
                const request: mssql.Request = new originalRequest(...arguments);
                thisPlugin._wrap(request, 'query', thisPlugin._patchQuery(request));
                return request;
            };
        };
    }

    private _patchQuery(request: mssql.Request) {
        return (originalQuery: Function) => {
            const thisPlugin = this;
            thisPlugin._logger.debug(
                'MssqlPlugin#patch: patching mssql request query'
            );
            return function query(command: string | TemplateStringsArray): Promise<mssql.IResult<any>> {
                const span = thisPlugin.tracer.startSpan(getSpanName(command), {
                    kind: SpanKind.CLIENT,
                    attributes: {
                        ...MssqlInstrumentation.COMMON_ATTRIBUTES,
                        ...getConnectionAttributes(thisPlugin.mssqlConfig)
                    },
                });
                span.setAttribute(DatabaseAttribute.DB_STATEMENT, thisPlugin.formatDbStatement(command));

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

    private formatDbStatement(command: string | TemplateStringsArray) {
        if (typeof command === 'object') {
            return command[0];
        }
        return command;
    }

    protected unpatch(moduleExports: typeof mssql): void {
        if (isWrapped(moduleExports.ConnectionPool)) {
            this._unwrap(moduleExports, 'ConnectionPool');
        }
        if (isWrapped(moduleExports.Request)) {
            this._unwrap(moduleExports, 'Request');
        }
    }
}