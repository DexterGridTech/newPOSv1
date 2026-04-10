import {nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {TopologyRecoveryState} from '@impos2/kernel-base-topology-runtime'
import type {CreateTopologyClientContextInput, TopologyClientContextState} from '../types'

const deriveWorkspace = (
    instanceMode?: string,
    displayMode?: string,
) => {
    if (instanceMode === 'SLAVE' && displayMode === 'PRIMARY') {
        return 'BRANCH'
    }
    return 'MAIN'
}

const deriveStandalone = (
    instanceMode?: string,
    masterInfo?: TopologyRecoveryState['masterInfo'],
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

export const createTopologyClientContext = (
    input: CreateTopologyClientContextInput,
): TopologyClientContextState => {
    const recoveryState = input.topology.getRecoveryState()
    const instanceMode = recoveryState.instanceMode ?? (input.displayIndex === 0 ? 'MASTER' : 'SLAVE')
    const displayMode = recoveryState.displayMode ?? (input.displayIndex === 0 ? 'PRIMARY' : 'SECONDARY')
    const standalone = deriveStandalone(instanceMode, recoveryState.masterInfo, input.displayIndex)

    return {
        localNodeId: input.localNodeId as any,
        instanceMode,
        displayMode,
        workspace: deriveWorkspace(instanceMode, displayMode),
        standalone,
        enableSlave: recoveryState.enableSlave ?? Boolean(input.displayCount && input.displayCount > 1 && standalone),
        masterInfo: recoveryState.masterInfo,
        updatedAt: (input.updatedAt ?? nowTimestampMs()) as any,
    }
}
