import { RuntimeConfig } from './types';
export interface ServerConfig {
    port: number;
    basePath: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}
export declare const DEFAULT_SERVER_CONFIG: ServerConfig;
export declare const DEFAULT_RUNTIME_CONFIG: RuntimeConfig;
export declare function mergeServerConfig(custom?: Partial<ServerConfig>): ServerConfig;
export declare function mergeRuntimeConfig(custom?: Partial<RuntimeConfig>): RuntimeConfig;
//# sourceMappingURL=config.d.ts.map