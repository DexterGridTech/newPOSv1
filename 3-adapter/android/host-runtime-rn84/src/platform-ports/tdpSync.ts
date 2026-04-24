import type {LoggerPort} from '@next/kernel-base-platform-ports'
import type {RuntimeModuleContextV2} from '@next/kernel-base-runtime-shell-v2'
import {
    createHttpRuntime,
    createSocketRuntime,
    type TransportServerDefinition,
} from '@next/kernel-base-transport-runtime'
import {
    tdpSyncV2SocketProfile,
    type TdpSyncRuntimeAssemblyV2,
} from '@next/kernel-base-tdp-sync-runtime-v2'
import {moduleName} from '../moduleName'
import {
    createAssemblyFetchTransport,
    createAssemblyWebSocketTransport,
} from './transport'

export const createAssemblyTdpSyncRuntimeAssembly = (input: {
    logger: LoggerPort
    mockTerminalPlatformBaseUrl?: string
    resolveServers: (context?: Pick<RuntimeModuleContextV2, 'getState'>) => readonly TransportServerDefinition[]
}): TdpSyncRuntimeAssemblyV2 => {
    const httpTransport = createAssemblyFetchTransport()

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
                serverProvider: () => input.resolveServers(context),
                executionPolicy: {
                    retryRounds: 1,
                    failoverStrategy: 'ordered',
                },
            })
        },
        resolveSocketBinding(context) {
            const socketRuntime = createSocketRuntime({
                logger: input.logger.scope({
                    moduleName,
                    layer: 'assembly',
                    subsystem: 'tdp-sync',
                    component: 'SocketRuntime',
                }),
                transport: createAssemblyWebSocketTransport(),
                serverProvider: () => input.resolveServers(context),
            })
            return {
                socketRuntime,
                profileName: tdpSyncV2SocketProfile.name,
                profile: tdpSyncV2SocketProfile,
            }
        },
    }
}
