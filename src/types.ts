import { InstrumentationConfig } from '@opentelemetry/instrumentation';


export interface MssqlInstrumentationConfig extends InstrumentationConfig {
    /** Set to true if you only want to trace operation which has parent spans */
    ignoreOrphanedSpans?: boolean;
}
