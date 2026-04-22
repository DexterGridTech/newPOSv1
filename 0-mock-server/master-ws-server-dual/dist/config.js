export const DEFAULT_SERVER_CONFIG = {
    port: 8888,
    basePath: '/mockMasterServer',
    logLevel: 'info',
};
export const DEFAULT_RUNTIME_CONFIG = {
    tokenExpireTime: 5 * 60 * 1000,
    heartbeatInterval: 30 * 1000,
    heartbeatTimeout: 60 * 1000,
    retryCacheTimeout: 30 * 1000,
};
export function mergeServerConfig(custom) {
    return { ...DEFAULT_SERVER_CONFIG, ...custom };
}
export function mergeRuntimeConfig(custom) {
    return { ...DEFAULT_RUNTIME_CONFIG, ...custom };
}
//# sourceMappingURL=config.js.map