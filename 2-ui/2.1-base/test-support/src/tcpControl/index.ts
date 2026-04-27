import {
    createTcpControlRuntimeModuleV2,
    type CreateTcpControlRuntimeModuleV2Input,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    createHttpRuntime,
    type TransportServerDefinition,
} from '@next/kernel-base-transport-runtime'
import {createBrowserFetchTransport} from '../transport'

export interface CreateExpoWebTcpControlRuntimeModuleInput {
    loggerModuleName: string
    servers: readonly TransportServerDefinition[]
    transport?: Parameters<typeof createBrowserFetchTransport>[0]
}

export const createExpoWebTcpControlRuntimeModule = (
    input: CreateExpoWebTcpControlRuntimeModuleInput,
): ReturnType<typeof createTcpControlRuntimeModuleV2> => {
    const assembly: NonNullable<CreateTcpControlRuntimeModuleV2Input['assembly']> = {
        createHttpRuntime(context) {
            return createHttpRuntime({
                logger: context.platformPorts.logger.scope({
                    moduleName: input.loggerModuleName,
                    subsystem: 'transport.http',
                }),
                transport: createBrowserFetchTransport(input.transport),
                servers: input.servers,
            })
        },
    }
    return createTcpControlRuntimeModuleV2({assembly})
}
