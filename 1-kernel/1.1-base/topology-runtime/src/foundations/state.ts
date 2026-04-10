import {createStateRuntime} from '@impos2/kernel-base-state-runtime'
import type {TopologyRecoveryState} from '../types/state'
import {
    TOPOLOGY_RECOVERY_STATE_KEY,
    topologyRecoveryStateActions,
    topologyRecoveryStateSliceDescriptor,
} from '../features/slices'

export const createTopologyRecoveryState = (
    input: Pick<
        Parameters<typeof createStateRuntime>[0],
        'logger' | 'stateStorage' | 'secureStateStorage' | 'persistenceKey' | 'allowPersistence'
    >,
) => {
    const stateRuntime = createStateRuntime({
        runtimeName: 'topology-runtime.recovery-state',
        logger: input.logger,
        stateStorage: input.stateStorage,
        secureStateStorage: input.secureStateStorage,
        persistenceKey: input.persistenceKey,
        allowPersistence: input.allowPersistence,
        slices: [topologyRecoveryStateSliceDescriptor],
    })

    const selectState = (): TopologyRecoveryState => {
        const state = stateRuntime.getState() as Record<string, TopologyRecoveryState>
        return state[TOPOLOGY_RECOVERY_STATE_KEY] ?? {}
    }

    return {
        getState(): TopologyRecoveryState {
            return selectState()
        },
        replaceState(nextState: TopologyRecoveryState) {
            stateRuntime.getStore().dispatch(
                topologyRecoveryStateActions.replaceRecoveryState(nextState),
            )
        },
        updateState(patch: TopologyRecoveryState) {
            stateRuntime.getStore().dispatch(
                topologyRecoveryStateActions.updateRecoveryState(patch),
            )
        },
        async hydrate() {
            await stateRuntime.hydratePersistence()
        },
        async flush() {
            await stateRuntime.flushPersistence()
        },
        getStateRuntime() {
            return stateRuntime
        },
    }
}
