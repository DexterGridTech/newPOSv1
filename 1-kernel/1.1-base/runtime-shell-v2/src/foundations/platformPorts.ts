import type {LoggerPort, PlatformPorts} from '@impos2/kernel-base-platform-ports'

const noopLogger: LoggerPort = {
    emit() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    scope() {
        return this
    },
    withContext() {
        return this
    },
}

export const createDefaultRuntimePlatformPortsV2 = (
    ports?: Partial<PlatformPorts>,
): PlatformPorts => ({
    environmentMode: ports?.environmentMode ?? 'DEV',
    logger: ports?.logger ?? noopLogger,
    scriptExecutor: ports?.scriptExecutor,
    stateStorage: ports?.stateStorage,
    secureStateStorage: ports?.secureStateStorage,
    device: ports?.device,
    appControl: ports?.appControl,
    hotUpdate: ports?.hotUpdate,
    localWebServer: ports?.localWebServer,
    connector: ports?.connector,
})
