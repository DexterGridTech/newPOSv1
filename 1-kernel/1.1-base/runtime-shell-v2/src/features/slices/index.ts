export * from './errorCatalogState'
export * from './parameterCatalogState'

import {
    runtimeShellV2ErrorCatalogStateActions,
    runtimeShellV2ErrorCatalogStateSliceDescriptor,
} from './errorCatalogState'
import {
    runtimeShellV2ParameterCatalogStateActions,
    runtimeShellV2ParameterCatalogStateSliceDescriptor,
} from './parameterCatalogState'

export const runtimeShellV2StateActions = {
    ...runtimeShellV2ErrorCatalogStateActions,
    ...runtimeShellV2ParameterCatalogStateActions,
}

export const runtimeShellV2StateSlices = [
    runtimeShellV2ErrorCatalogStateSliceDescriptor,
    runtimeShellV2ParameterCatalogStateSliceDescriptor,
] as const
