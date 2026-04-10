/**
 * Local state slices or reducers for this package belong here.
 */
export * from './runtimeMetaState'
export * from './requestProjectionState'
export * from './errorCatalogState'
export * from './parameterCatalogState'

import {errorCatalogStateActions, errorCatalogStateSliceDescriptor} from './errorCatalogState'
import {parameterCatalogStateActions, parameterCatalogStateSliceDescriptor} from './parameterCatalogState'
import {requestProjectionStateActions, requestProjectionStateSliceDescriptor} from './requestProjectionState'
import {runtimeMetaStateActions, runtimeMetaStateSliceDescriptor} from './runtimeMetaState'

export const runtimeShellStateActions = {
    ...runtimeMetaStateActions,
    ...requestProjectionStateActions,
    ...errorCatalogStateActions,
    ...parameterCatalogStateActions,
}

export const runtimeShellStateSliceDescriptors = [
    runtimeMetaStateSliceDescriptor,
    requestProjectionStateSliceDescriptor,
    errorCatalogStateSliceDescriptor,
    parameterCatalogStateSliceDescriptor,
]
