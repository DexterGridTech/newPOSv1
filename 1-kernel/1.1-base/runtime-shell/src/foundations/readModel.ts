import type {
    ErrorCatalogEntry,
    ParameterCatalogEntry,
    ProjectionMirrorEnvelope,
    RequestId,
    RequestProjection,
    RuntimeInstanceId,
} from '@impos2/kernel-base-contracts'
import type {
    RuntimeReadModel,
    RuntimeShellState,
    RuntimeShellStateSnapshot,
} from '../types/state'
import {createStateRuntime} from '@impos2/kernel-base-state-runtime'
import {
    RUNTIME_ERROR_CATALOG_STATE_KEY,
    RUNTIME_META_STATE_KEY,
    RUNTIME_PARAMETER_CATALOG_STATE_KEY,
    RUNTIME_REQUEST_PROJECTION_STATE_KEY,
    runtimeShellStateActions,
    runtimeShellStateSliceDescriptors,
} from '../features/slices'

export const createRuntimeReadModel = (
    runtimeId: RuntimeInstanceId,
    input?: Pick<
        Parameters<typeof createStateRuntime>[0],
        'logger' | 'stateStorage' | 'secureStateStorage' | 'persistenceKey' | 'allowPersistence'
    >,
): RuntimeReadModel => {
    const stateRuntime = createStateRuntime({
        runtimeName: 'runtime-shell.read-model',
        logger: input?.logger,
        stateStorage: input?.stateStorage,
        secureStateStorage: input?.secureStateStorage,
        persistenceKey: input?.persistenceKey,
        allowPersistence: input?.allowPersistence,
        slices: runtimeShellStateSliceDescriptors,
    })
    const store = stateRuntime.getStore()
    store.dispatch(runtimeShellStateActions.setRuntimeId(runtimeId))

    const readState = (): RuntimeShellState => {
        const state = stateRuntime.getState() as Record<string, any>
        return {
            runtimeId: state[RUNTIME_META_STATE_KEY]?.runtimeId ?? runtimeId,
            requestProjections: {...(state[RUNTIME_REQUEST_PROJECTION_STATE_KEY] ?? {})},
            errorCatalog: {...(state[RUNTIME_ERROR_CATALOG_STATE_KEY] ?? {})},
            parameterCatalog: {...(state[RUNTIME_PARAMETER_CATALOG_STATE_KEY] ?? {})},
        }
    }

    const getState = (): RuntimeShellStateSnapshot => {
        return readState()
    }

    return {
        getState,
        async hydrate() {
            await stateRuntime.hydratePersistence()
            store.dispatch(runtimeShellStateActions.setRuntimeId(runtimeId))
        },
        async flush() {
            await stateRuntime.flushPersistence()
        },
        replaceState(nextState) {
            store.dispatch(runtimeShellStateActions.setRuntimeId(nextState.runtimeId))
            store.dispatch(runtimeShellStateActions.replaceRequestProjections(nextState.requestProjections))
            store.dispatch(runtimeShellStateActions.replaceErrorCatalog(nextState.errorCatalog))
            store.dispatch(runtimeShellStateActions.replaceParameterCatalog(nextState.parameterCatalog))
        },
        setRequestProjection(requestId: RequestId, projection: RequestProjection) {
            store.dispatch(
                runtimeShellStateActions.setRequestProjection({
                    requestId,
                    projection,
                }),
            )
        },
        applyProjectionMirror(envelope: ProjectionMirrorEnvelope) {
            const current = readState().requestProjections[envelope.projection.requestId]
            if (current && current.updatedAt > envelope.projection.updatedAt) {
                return
            }

            store.dispatch(
                runtimeShellStateActions.setRequestProjection({
                    requestId: envelope.projection.requestId,
                    projection: envelope.projection,
                }),
            )
        },
        setErrorCatalogEntry(entry: ErrorCatalogEntry) {
            store.dispatch(runtimeShellStateActions.setErrorCatalogEntry(entry))
        },
        removeErrorCatalogEntry(key: string) {
            store.dispatch(runtimeShellStateActions.removeErrorCatalogEntry(key))
        },
        setParameterCatalogEntry(entry: ParameterCatalogEntry) {
            store.dispatch(runtimeShellStateActions.setParameterCatalogEntry(entry))
        },
        removeParameterCatalogEntry(key: string) {
            store.dispatch(runtimeShellStateActions.removeParameterCatalogEntry(key))
        },
    }
}
