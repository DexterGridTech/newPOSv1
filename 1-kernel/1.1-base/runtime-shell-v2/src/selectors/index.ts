import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    RUNTIME_SHELL_V2_ERROR_CATALOG_STATE_KEY,
    RUNTIME_SHELL_V2_PARAMETER_CATALOG_STATE_KEY,
} from '../features/slices'
import type {ErrorCatalogEntry, ParameterCatalogEntry} from '@impos2/kernel-base-contracts'

export const selectRuntimeShellV2ErrorCatalog = (state: RootState) =>
    (state[RUNTIME_SHELL_V2_ERROR_CATALOG_STATE_KEY as keyof RootState] as Record<string, ErrorCatalogEntry> | undefined) ?? {}

export const selectRuntimeShellV2ParameterCatalog = (state: RootState) =>
    (state[RUNTIME_SHELL_V2_PARAMETER_CATALOG_STATE_KEY as keyof RootState] as Record<string, ParameterCatalogEntry> | undefined) ?? {}
