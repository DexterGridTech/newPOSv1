import type {
    DeriveTopologyV3RuntimeContextInput,
    TopologyV3RuntimeContext,
} from '../types'

export const deriveTopologyV3Workspace = (
    instanceMode: 'MASTER' | 'SLAVE',
    displayMode: 'PRIMARY' | 'SECONDARY',
): 'MAIN' | 'BRANCH' => {
    if (instanceMode === 'SLAVE' && displayMode === 'PRIMARY') {
        return 'BRANCH'
    }
    return 'MAIN'
}

export const deriveTopologyV3RuntimeContext = (
    input: DeriveTopologyV3RuntimeContextInput,
): TopologyV3RuntimeContext => {
    if (typeof input.displayIndex !== 'number' || typeof input.displayCount !== 'number') {
        throw new Error('displayIndex/displayCount are required for topology-runtime-v3')
    }

    const standalone = input.displayIndex === 0
    const instanceMode = input.configState.instanceMode ?? (standalone ? 'MASTER' : 'SLAVE')
    const displayMode = input.configState.displayMode ?? (standalone ? 'PRIMARY' : 'SECONDARY')

    return {
        displayIndex: input.displayIndex,
        displayCount: input.displayCount,
        instanceMode,
        displayMode,
        workspace: deriveTopologyV3Workspace(instanceMode, displayMode),
        standalone,
        enableSlave: input.configState.enableSlave ?? Boolean(input.displayCount > 1 && standalone),
        masterLocator: input.configState.masterLocator,
    }
}
