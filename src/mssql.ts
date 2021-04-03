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
    SpanStatusCode,
    getSpan,
    context,
    diag
} from '@opentelemetry/api';

import type * as mssql from 'mssql';
import { MssqlInstrumentationConfig } from './types';
import { getConnectionAttributes, getSpanName } from './Spans';
import { VERSION } from './version';

type Config = InstrumentationConfig & MssqlInstrumentationConfig;

export class MssqlInstrumentation extends InstrumentationBase<typeof mssql> {

    static readonly COMPONENT = 'mssql';
    static readonly COMMON_ATTRIBUTES = {
        [DatabaseAttribute.DB_SYSTEM]: MssqlInstrumentation.COMPONENT,
    };

    constructor(config: Config = {}) {
        super('opentelemetry-instrumentation-mssql', VERSION, Object.assign({}, config));
    }

    private _getConfig(): MssqlInstrumentationConfig {
        return this._config as MssqlInstrumentationConfig;
    }

    protected init(): InstrumentationModuleDefinition<typeof mssql> | InstrumentationModuleDefinition<typeof mssql>[] | void {
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
        diag.debug(`applying patch to ${MssqlInstrumentation.COMPONENT}`);
        this.unpatch(moduleExports);
        /** 
        shimmer.wrap(
            moduleExports,
            'ConnectionPool',
            this._patchCreatePool() as any
          );
      
          shimmer.wrap(
            moduleExports,
            'Request',
            this._patchRequest() as any
          );*/
        this._wrap(moduleExports, 'ConnectionPool', this._patchCreatePool() as any);
        this._wrap(moduleExports, 'Request', this._patchRequest() as any);

        return moduleExports;
    }

    // global export function
    private _patchCreatePool() {
        return (originalConnectionPool: any) => {
            const thisInstrumentation = this;
            diag.debug('MssqlPlugin#patch: patching mssql ConnectionPool');
            return function createPool(_config: string | mssql.config) {
                if (thisInstrumentation._getConfig()?.ignoreOrphanedSpans && !getSpan(context.active())) {
                    return new originalConnectionPool(...arguments);
                    //return new mssql.ConnectionPool(arguments[0]);
                }
                const pool = new originalConnectionPool(...arguments);
                thisInstrumentation._wrap(pool, 'query', thisInstrumentation._patchPoolQuery(pool));
                thisInstrumentation._wrap(pool, 'Request', thisInstrumentation._patchRequest() as any);
                //shimmer.wrap(pool, 'query', thisInstrumentation._patchPoolQuery(pool));
                return pool;
            };
        };
    }

    private _patchPoolQuery(pool: mssql.ConnectionPool) {
        return (originalQuery: Function) => {
            const thisInstrumentation = this;
            diag.debug('MssqlPlugin#patch: patching mssql pool request');
            return function request() {
                if (thisInstrumentation.shouldIgnoreOrphanSpans(thisInstrumentation._getConfig())) {
                    return originalQuery.apply(pool, arguments);
                }
                const args = arguments[0];
                const span = thisInstrumentation.tracer.startSpan(getSpanName(args[0]), {
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
            const thisInstrumentation = this;
            diag.debug('MssqlPlugin#patch: patching mssql pool request');
            return function request() {
                const request: mssql.Request = new originalRequest(...arguments);
                thisInstrumentation._wrap(request, 'query', thisInstrumentation._patchQuery(request));
                //shimmer.wrap(request, 'query', thisInstrumentation._patchQuery(request));
                return request;
            };
        };
    }

    private _patchQuery(request: mssql.Request) {
        return (originalQuery: Function) => {
            const thisInstrumentation = this;

            diag.debug('MssqlPlugin#patch: patching mssql request query');
            return function query(command: string | TemplateStringsArray): Promise<mssql.IResult<any>> {
                if (thisInstrumentation.shouldIgnoreOrphanSpans(thisInstrumentation._getConfig())) {
                    return originalQuery.apply(request, arguments);
                }
                const span = thisInstrumentation.tracer.startSpan(getSpanName(command), {
                    kind: SpanKind.CLIENT,
                    attributes: {
                        ...MssqlInstrumentation.COMMON_ATTRIBUTES,
                        ...getConnectionAttributes((<any>request).parent!.config)
                    },
                });
                var interpolated = thisInstrumentation.formatDbStatement(command)
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

    private shouldIgnoreOrphanSpans(config: MssqlInstrumentationConfig) {
        return config?.ignoreOrphanedSpans && !getSpan(context.active())
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
            //shimmer.unwrap(moduleExports, 'ConnectionPool');
            
        }
        if (isWrapped(moduleExports.Request)) {
            this._unwrap(moduleExports, 'Request');
            //shimmer.unwrap(moduleExports, 'Request');
        }
    }
}