import type {
    ErrorCatalogEntry,
    ParameterCatalogEntry,
    RequestId,
    RequestProjection,
} from '@impos2/kernel-base-contracts'
import type {RuntimeShellStateSnapshot} from '../types/state'

export const selectRuntimeShellState = (
    state: RuntimeShellStateSnapshot,
): RuntimeShellStateSnapshot => state

export const selectRequestProjection = (
    state: RuntimeShellStateSnapshot,
    requestId: RequestId,
): RequestProjection | undefined => {
    return state.requestProjections[requestId]
}

export const selectErrorCatalogEntry = (
    state: RuntimeShellStateSnapshot,
    key: string,
): ErrorCatalogEntry | undefined => {
    return state.errorCatalog[key]
}

export const selectParameterCatalogEntry = (
    state: RuntimeShellStateSnapshot,
    key: string,
): ParameterCatalogEntry | undefined => {
    return state.parameterCatalog[key]
}
