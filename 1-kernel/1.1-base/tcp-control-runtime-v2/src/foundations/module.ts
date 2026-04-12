import type {KernelRuntimeModuleV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {HttpTransport} from '@impos2/kernel-base-transport-runtime'
import {createHttpRuntime} from '@impos2/kernel-base-transport-runtime'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {
    createTcpControlActorDefinitionsV2,
    type TcpControlServiceRefV2,
} from '../features/actors'
import {tcpControlV2CommandDefinitions} from '../features/commands'
import {tcpControlV2StateSlices} from '../features/slices'
import {
    tcpControlV2ErrorDefinitionList,
    tcpControlV2ParameterDefinitionList,
} from '../supports'
import {createTcpControlHttpServiceV2} from './httpService'
import type {CreateTcpControlRuntimeModuleV2Input} from '../types'

const createFetchHttpTransport = (): HttpTransport => {
    return {
        async execute(request) {
            const response = await fetch(request.url, {
                method: request.endpoint.method,
                headers: {
                    'content-type': 'application/json',
                    ...(request.input.headers ?? {}),
                },
                body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
            })

            return {
                data: await response.json(),
                status: response.status,
                statusText: response.statusText,
                headers: (() => {
                    const headers: Record<string, string> = {}
                    response.headers.forEach((value, key) => {
                        headers[key] = value
                    })
                    return headers
                })(),
            }
        },
    }
}

export const createTcpControlRuntimeModuleV2 = (
    input: CreateTcpControlRuntimeModuleV2Input = {},
): KernelRuntimeModuleV2 => {
    const serviceRef: TcpControlServiceRefV2 = {}

    return {
        moduleName,
        packageVersion,
        stateSlices: tcpControlV2StateSlices,
        commandDefinitions: Object.values(tcpControlV2CommandDefinitions),
        actorDefinitions: createTcpControlActorDefinitionsV2(serviceRef),
        errorDefinitions: tcpControlV2ErrorDefinitionList,
        parameterDefinitions: tcpControlV2ParameterDefinitionList,
        install(context) {
            const httpRuntime = input.assembly?.createHttpRuntime(context) ?? createHttpRuntime({
                logger: context.platformPorts.logger.scope({
                    moduleName,
                    subsystem: 'transport.http',
                    component: 'TcpControlHttpRuntimeV2',
                }),
                transport: createFetchHttpTransport(),
                servers: [
                    {
                        serverName: 'mock-terminal-platform',
                        addresses: [
                            {
                                addressName: 'local-default',
                                baseUrl: 'http://127.0.0.1:5810',
                            },
                        ],
                    },
                ],
            })
            serviceRef.current = createTcpControlHttpServiceV2(httpRuntime)

            context.platformPorts.logger.info({
                category: 'runtime.load',
                event: 'tcp-control-runtime-v2-install',
                message: 'install tcp control runtime v2 contents',
                data: {
                    moduleName,
                    stateSlices: tcpControlV2StateSlices.map(slice => slice.name),
                    commandNames: Object.values(tcpControlV2CommandDefinitions).map(item => item.commandName),
                },
            })
        },
    }
}
