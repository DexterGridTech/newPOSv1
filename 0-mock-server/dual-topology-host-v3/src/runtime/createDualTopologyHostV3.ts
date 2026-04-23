import type {DualTopologyHostV3} from '../types/hostShell'

export const createDualTopologyHostV3 = (): DualTopologyHostV3 => {
    let state: 'idle' | 'running' | 'closed' = 'idle'

    return {
        getSnapshot() {
            return {
                state,
                sessionCount: 0,
            }
        },
        markRunning() {
            state = 'running'
        },
        markClosed() {
            state = 'closed'
        },
    }
}
