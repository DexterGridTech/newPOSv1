import {nowTimestampMs, type NodeRuntimeInfo} from '@impos2/kernel-base-contracts'
import type {
    TopologyV2ContextState,
    TopologyV2PeerState,
    TopologyV2RecoveryState,
} from '../types'

export const deriveTopologyWorkspace = (
    instanceMode?: string,
    displayMode?: string,
) => {
    if (instanceMode === 'SLAVE' && displayMode === 'PRIMARY') {
        return 'BRANCH'
    }
    return 'MAIN'
}

export const deriveTopologyStandalone = (
    instanceMode?: string,
    masterInfo?: TopologyV2RecoveryState['masterInfo'],
    displayIndex?: number,
) => {
    if (typeof displayIndex === 'number') {
        return displayIndex === 0
    }
    if (instanceMode === 'SLAVE') {
        return false
    }
    return masterInfo == null
}

export const createTopologyContextState = (input: {
    localNodeId: string
    recoveryState: TopologyV2RecoveryState
    displayIndex?: number
    displayCount?: number
    updatedAt?: number
}): TopologyV2ContextState => {
    /**
     * 设计意图：
     * topology context 把旧 Core 的 instanceMode/displayMode/workspace/displayIndex 规则显式化。
     * 这些值会影响自动连接、同步方向和主副屏路由，所以必须在启动时从持久化 recoveryState 和终端显示信息共同推导。
     */
    const instanceMode = input.recoveryState.instanceMode ?? (input.displayIndex === 0 ? 'MASTER' : 'SLAVE')
    const displayMode = input.recoveryState.displayMode ?? (input.displayIndex === 0 ? 'PRIMARY' : 'SECONDARY')
    const standalone = deriveTopologyStandalone(instanceMode, input.recoveryState.masterInfo, input.displayIndex)

    return {
        localNodeId: input.localNodeId as any,
        instanceMode,
        displayMode,
        workspace: deriveTopologyWorkspace(instanceMode, displayMode),
        standalone,
        enableSlave: input.recoveryState.enableSlave ?? Boolean(input.displayCount && input.displayCount > 1 && standalone),
        masterInfo: input.recoveryState.masterInfo,
        updatedAt: (input.updatedAt ?? nowTimestampMs()) as any,
    }
}

export const createPeerStateFromRuntimeInfo = (
    runtime?: NodeRuntimeInfo,
): TopologyV2PeerState => {
    if (!runtime) {
        return {}
    }
    return {
        peerNodeId: runtime.nodeId,
        peerDeviceId: runtime.deviceId,
        peerInstanceMode: runtime.role === 'slave' ? 'SLAVE' : 'MASTER',
        peerDisplayMode: runtime.role === 'slave' ? 'SECONDARY' : 'PRIMARY',
        peerWorkspace: runtime.role === 'slave' ? 'BRANCH' : 'MAIN',
        connectedAt: nowTimestampMs(),
    }
}
