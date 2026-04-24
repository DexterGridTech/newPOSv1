import type {CreateTopologyRuntimeModuleV3Input, TopologyV3HelloRuntime} from '@next/kernel-base-topology-runtime-v3'
import {
    defineSocketProfile,
    JsonSocketCodec,
    typed,
    createSocketRuntime,
} from '@next/kernel-base-transport-runtime'
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
    displayIndex: number
}): TopologyV3HelloRuntime => {
    return {
        nodeId: input.nodeId as any,
        deviceId: input.deviceId,
        instanceMode: input.role === 'slave' ? 'SLAVE' : 'MASTER',
        displayMode: input.displayIndex > 0 ? 'SECONDARY' : 'PRIMARY',
        standalone: input.displayIndex === 0,
        protocolVersion: '2026.04-v3',
        capabilities: ['state-sync', 'command-relay', 'request-mirror'],
    }
}

/**
 * 设计意图：
 * 把 dual-topology-host-v3 的 hello/socket profile 拼装收拢到一个 test helper，
 * 页面层只关心“当前是否走真实 topology host 模式”。
 */
export const createTopologyHostAssembly = (
    config: RuntimeReactExpoConfig,
): CreateTopologyRuntimeModuleV3Input | undefined => {
    if (config.topologyMode !== 'host') {
        return undefined
    }
    if (!config.topologyHostBaseUrl || !config.topologyWsUrl) {
        throw new Error('topology host mode requires topologyHostBaseUrl and topologyWsUrl')
    }

    const wsUrl = new URL(config.topologyWsUrl)
    const profile = defineSocketProfile<void, void, Record<string, string>, any, any>({
        name: config.topologyProfileName ?? 'runtime-react.expo.topology-host',
        serverName: 'dual-topology-host-v3',
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
                serverName: 'dual-topology-host-v3',
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
            createHelloRuntime(context) {
                return createRuntimeInfo({
                    nodeId: context.localNodeId,
                    deviceId: config.deviceId,
                    role: config.topologyRole,
                    displayIndex: config.displayIndex,
                })
            },
        },
    }
}
