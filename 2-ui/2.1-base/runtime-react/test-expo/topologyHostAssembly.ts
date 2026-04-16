import type {CreateTopologyRuntimeModuleV2Input} from '@impos2/kernel-base-topology-runtime-v2'
import {
    defineSocketProfile,
    JsonSocketCodec,
    typed,
    createSocketRuntime,
} from '@impos2/kernel-base-transport-runtime'
import type {RuntimeReactExpoConfig} from './runtimeReactExpoConfig'
import {createBrowserWsTransport} from './browserWsTransport'
import {createBrowserConsoleLogger} from '../test/support/browserConsoleLogger'

const createExpoLogger = (scopeName: string) => {
    return createBrowserConsoleLogger({
        environmentMode: 'DEV',
        scope: {
            moduleName: scopeName,
            layer: 'ui',
        },
    })
}

const createRuntimeInfo = (input: {
    nodeId: string
    deviceId: string
    role: 'master' | 'slave'
}) => {
    return {
        nodeId: input.nodeId as any,
        deviceId: input.deviceId,
        role: input.role,
        platform: 'web',
        product: 'runtime-react-test-expo',
        assemblyAppId: 'ui.base.runtime-react.test-expo',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        bundleVersion: '1',
        runtimeVersion: '1.0.0',
        protocolVersion: '2026.04',
        capabilities: ['projection-mirror', 'dispatch-relay'],
    }
}

/**
 * 设计意图：
 * 把 dual-topology-host 的 hello/ticket/socket profile 拼装收拢到一个 test helper，
 * 页面层只关心“当前是否走真实 topology host 模式”。
 */
export const createTopologyHostAssembly = (
    config: RuntimeReactExpoConfig,
): CreateTopologyRuntimeModuleV2Input | undefined => {
    if (config.topologyMode !== 'host') {
        return undefined
    }
    if (!config.topologyHostBaseUrl || !config.topologyWsUrl || !config.topologyTicketToken) {
        throw new Error('topology host mode requires topologyHostBaseUrl, topologyWsUrl and topologyTicketToken')
    }

    const wsUrl = new URL(config.topologyWsUrl)
    const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
        name: config.topologyProfileName ?? 'runtime-react.expo.topology-host',
        serverName: 'dual-topology-host',
        pathTemplate: wsUrl.pathname,
        handshake: {
            headers: typed<Record<string, string>>('runtime-react-expo.topology.headers'),
        },
        messages: {
            incoming: typed('runtime-react-expo.topology.incoming'),
            outgoing: typed('runtime-react-expo.topology.outgoing'),
        },
        codec: new JsonSocketCodec(),
        meta: {
            reconnectAttempts: 0,
        },
    })

    const socketRuntime = createSocketRuntime({
        logger: createExpoLogger('ui.base.runtime-react.test-expo.socket'),
        transport: createBrowserWsTransport(),
        servers: [
            {
                serverName: 'dual-topology-host',
                addresses: [
                    {
                        addressName: 'local',
                        baseUrl: wsUrl.origin,
                    },
                ],
            },
        ],
    })

    return {
        assembly: {
            resolveSocketBinding() {
                return {
                    socketRuntime,
                    profileName: profile.name,
                    profile,
                }
            },
            createHello(context) {
                return {
                    helloId: `hello_${context.localNodeId}`,
                    ticketToken: config.topologyTicketToken as any,
                    runtime: createRuntimeInfo({
                        nodeId: context.localNodeId,
                        deviceId: config.deviceId,
                        role: config.topologyRole,
                    }),
                    sentAt: Date.now() as any,
                }
            },
            getRuntimeInfo(context) {
                return createRuntimeInfo({
                    nodeId: context.localNodeId,
                    deviceId: config.deviceId,
                    role: config.topologyRole,
                })
            },
        },
    }
}
