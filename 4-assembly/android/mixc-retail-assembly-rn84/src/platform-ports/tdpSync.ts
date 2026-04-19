import type {LoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    createHttpRuntime,
    createSocketRuntime,
} from '@impos2/kernel-base-transport-runtime'
import {
    tdpSyncV2SocketProfile,
    type TdpSyncRuntimeAssemblyV2,
} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {moduleName} from '../moduleName'
import {
    createAssemblyFetchTransport,
    createAssemblyWebSocketTransport,
} from './transport'
import {resolveAssemblyTransportServers} from './serverSpaceState'

export const createAssemblyTdpSyncRuntimeAssembly = (input: {
    logger: LoggerPort
    mockTerminalPlatformBaseUrl?: string
}): TdpSyncRuntimeAssemblyV2 => {
    const httpTransport = createAssemblyFetchTransport()
    const socketRuntime = createSocketRuntime({
        logger: input.logger.scope({
            moduleName,
            layer: 'assembly',
            subsystem: 'tdp-sync',
            component: 'SocketRuntime',
        }),
        transport: createAssemblyWebSocketTransport(),
        serverProvider: () => resolveAssemblyTransportServers({
            mockTerminalPlatformBaseUrl: input.mockTerminalPlatformBaseUrl,
        }),
    })

    return {
        createHttpRuntime(context) {
            return createHttpRuntime({
                logger: context.platformPorts.logger.scope({
                    moduleName,
                    layer: 'assembly',
                    subsystem: 'transport.http',
                    component: 'TdpSyncHttpRuntime',
                }),
                transport: httpTransport,
                serverProvider: () => resolveAssemblyTransportServers({
                    mockTerminalPlatformBaseUrl: input.mockTerminalPlatformBaseUrl,
                }),
                executionPolicy: {
                    retryRounds: 1,
                    failoverStrategy: 'ordered',
                },
            })
        },
        resolveSocketBinding() {
            return {
                socketRuntime,
                profileName: tdpSyncV2SocketProfile.name,
                profile: tdpSyncV2SocketProfile,
            }
        },
    }
}
