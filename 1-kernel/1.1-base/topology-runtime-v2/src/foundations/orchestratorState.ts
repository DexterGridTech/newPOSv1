import type {
    NodeId,
    NodeRuntimeInfo,
} from '@impos2/kernel-base-contracts'
import {defineSocketProfile, JsonSocketCodec} from '@impos2/kernel-base-transport-runtime'
import type {RuntimeModuleContextV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {
    TopologyRuntimeV2Assembly,
    TopologyRuntimeV2SocketBinding,
} from '../types'
import {topologyRuntimeV2ParameterDefinitions} from '../supports'
import {
    TOPOLOGY_V2_CONNECTION_STATE_KEY,
    TOPOLOGY_V2_CONTEXT_STATE_KEY,
    TOPOLOGY_V2_RECOVERY_STATE_KEY,
    TOPOLOGY_V2_SYNC_STATE_KEY,
} from './stateKeys'

type RuntimeState = ReturnType<RuntimeModuleContextV2['getState']>

export const selectTopologyRecoveryState = (state: RuntimeState) =>
    state[TOPOLOGY_V2_RECOVERY_STATE_KEY as keyof RuntimeState] as
        | {instanceMode?: string; enableSlave?: boolean; masterInfo?: {serverAddress?: unknown[] | null} | null}
        | undefined

export const selectTopologyContextState = (state: RuntimeState) =>
    state[TOPOLOGY_V2_CONTEXT_STATE_KEY as keyof RuntimeState] as
        | {standalone?: boolean}
        | undefined

export const selectTopologyConnectionState = (state: RuntimeState) =>
    state[TOPOLOGY_V2_CONNECTION_STATE_KEY as keyof RuntimeState] as
        | {serverConnectionStatus?: string}
        | undefined

export const selectTopologySyncState = (state: RuntimeState) =>
    state[TOPOLOGY_V2_SYNC_STATE_KEY as keyof RuntimeState] as
        | {continuousSyncActive?: boolean}
        | undefined

export const shouldAutoConnectOnBoot = (context: RuntimeModuleContextV2) => {
    const recoveryState = selectTopologyRecoveryState(context.getState())
    return recoveryState?.instanceMode === 'SLAVE'
        ? Boolean(recoveryState.masterInfo)
        : recoveryState?.enableSlave === true
}

export const createConnectionPrecheckReasons = (
    context: RuntimeModuleContextV2,
    options?: {mode?: 'manual' | 'auto'},
): string[] => {
    const state = context.getState()
    const recoveryState = selectTopologyRecoveryState(state)
    const contextState = selectTopologyContextState(state)
    const connectionState = selectTopologyConnectionState(state)
    const status = connectionState?.serverConnectionStatus ?? 'DISCONNECTED'
    const instanceMode = recoveryState?.instanceMode ?? 'MASTER'
    const reasons: string[] = []

    if (status !== 'DISCONNECTED') {
        reasons.push(`serverConnectionStatus is ${status}, expected DISCONNECTED`)
    }

    if (instanceMode === 'SLAVE') {
        if (!recoveryState?.masterInfo) {
            reasons.push('masterInfo is required for SLAVE connection')
        }
        if (recoveryState?.masterInfo && (recoveryState.masterInfo.serverAddress?.length ?? 0) === 0) {
            reasons.push('masterInfo.serverAddress is required for SLAVE connection')
        }
        return reasons
    }

    if (options?.mode === 'auto' && contextState?.standalone === false) {
        reasons.push('MASTER connection requires standalone topology context')
    }
    if (options?.mode === 'auto' && recoveryState?.enableSlave !== true) {
        reasons.push('enableSlave must be true for MASTER connection')
    }

    return reasons
}

export const resolveSyncDirection = (input: {
    localInstanceMode?: string
    peerRole?: string
}): 'master-to-slave' | 'slave-to-master' => {
    if (input.localInstanceMode === 'SLAVE' || input.peerRole === 'master') {
        return 'master-to-slave'
    }
    return 'slave-to-master'
}

export const resolveAuthoritativeDirection = (localInstanceMode?: string): 'master-to-slave' | 'slave-to-master' => {
    return localInstanceMode === 'SLAVE'
        ? 'slave-to-master'
        : 'master-to-slave'
}

export const createResolvedBinding = (
    binding: TopologyRuntimeV2SocketBinding | undefined,
    context: RuntimeModuleContextV2,
    reconnectAttemptsOverride?: number,
): TopologyRuntimeV2SocketBinding | undefined => {
    if (!binding?.profile) {
        return binding
    }

    const connectionTimeoutMs = context.resolveParameter({
        key: topologyRuntimeV2ParameterDefinitions.serverConnectionTimeoutMs.key,
        definition: topologyRuntimeV2ParameterDefinitions.serverConnectionTimeoutMs,
    }).value
    const heartbeatTimeoutMs = context.resolveParameter({
        key: topologyRuntimeV2ParameterDefinitions.serverHeartbeatTimeoutMs.key,
        definition: topologyRuntimeV2ParameterDefinitions.serverHeartbeatTimeoutMs,
    }).value
    const reconnectDelayMs = context.resolveParameter({
        key: topologyRuntimeV2ParameterDefinitions.serverReconnectIntervalMs.key,
        definition: topologyRuntimeV2ParameterDefinitions.serverReconnectIntervalMs,
    }).value
    const reconnectAttempts = reconnectAttemptsOverride
        ?? context.resolveParameter({
            key: topologyRuntimeV2ParameterDefinitions.serverReconnectAttempts.key,
            definition: topologyRuntimeV2ParameterDefinitions.serverReconnectAttempts,
        }).value

    return {
        ...binding,
        profile: defineSocketProfile({
            name: binding.profile.name,
            serverName: binding.profile.serverName,
            pathTemplate: binding.profile.pathTemplate,
            handshake: binding.profile.handshake,
            messages: binding.profile.messages,
            codec: binding.profile.codec ?? new JsonSocketCodec(),
            meta: {
                ...binding.profile.meta,
                connectionTimeoutMs,
                heartbeatTimeoutMs,
                reconnectDelayMs,
                reconnectAttempts,
            },
        }),
    }
}

export const getLocalRuntimeInfo = (
    assembly: TopologyRuntimeV2Assembly,
    context: RuntimeModuleContextV2,
) => assembly.getRuntimeInfo?.(context) ?? assembly.createHello(context)?.runtime

export const createPeerRuntimeInfoFromNodeId = (
    peerNodeId: NodeId,
    assembly: TopologyRuntimeV2Assembly,
    context: RuntimeModuleContextV2,
): NodeRuntimeInfo => {
    const localRuntime = getLocalRuntimeInfo(assembly, context)
    const localRole = localRuntime?.role
    const peerRole: NodeRuntimeInfo['role'] = localRole === 'slave' ? 'master' : 'slave'
    return {
        nodeId: peerNodeId,
        deviceId: peerNodeId,
        role: peerRole,
        platform: localRuntime?.platform ?? 'unknown',
        product: localRuntime?.product ?? 'unknown',
        assemblyAppId: localRuntime?.assemblyAppId ?? 'unknown',
        assemblyVersion: localRuntime?.assemblyVersion ?? 'unknown',
        buildNumber: localRuntime?.buildNumber ?? 0,
        bundleVersion: localRuntime?.bundleVersion ?? 'unknown',
        runtimeVersion: localRuntime?.runtimeVersion ?? 'unknown',
        protocolVersion: localRuntime?.protocolVersion ?? 'unknown',
        capabilities: localRuntime?.capabilities ?? [],
    }
}
