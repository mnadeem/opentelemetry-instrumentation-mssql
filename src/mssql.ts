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
                    return new original(...arguments);
                    //return new mssql.ConnectionPool(arguments[0]);
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
        return (original: any) => {
            const thisInstrumentation = this;
            thisInstrumentation._logger.debug(
                'MssqlPlugin#patch: patching mssql pool request'
            );
            return function request() {
                if (thisInstrumentation._config?.ignoreOrphanedSpans && !getSpan(context.active())) {
                    //return original.apply(thisInstrumentation, arguments);
                    return new original(...arguments);
                }
                const request: mssql.Request = new original(...arguments);
                //const request: mssql.Request = original.apply(thisInstrumentation, arguments);
                thisInstrumentation._wrap(request, 'query', thisInstrumentation._patchQuery(request));
                return request;
            };
        };
    }

    private _patchQuery(original: mssql.Request) {
        return (originalQuery: Function) => {
            const thisInstrumentation = this;
            thisInstrumentation._logger.debug(
                'MssqlPlugin#patch: patching mssql request query'
            );
            return function query(command: string | TemplateStringsArray): Promise<mssql.IResult<any>> {
                if (thisInstrumentation._config?.ignoreOrphanedSpans && !getSpan(context.active())) {
                    return originalQuery.apply(original, arguments);
                }

                const span = thisInstrumentation.tracer.startSpan(getSpanName(command), {
                    kind: SpanKind.CLIENT,
                    attributes: {
                        ...MssqlInstrumentation.COMMON_ATTRIBUTES,
                        ...getConnectionAttributes(thisInstrumentation.mssqlConfig)
                    },
                });
                span.setAttribute(DatabaseAttribute.DB_STATEMENT, thisInstrumentation.formatDbStatement(command));

                const result = originalQuery.apply(original, arguments);

                result
                    .catch((error: mssql.MSSQLError) => {
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