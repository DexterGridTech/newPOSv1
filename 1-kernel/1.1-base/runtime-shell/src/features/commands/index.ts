/**
 * Command definitions for this package belong here.
 */
import {moduleName} from '../../moduleName'

export const runtimeShellCommandNames = {
    upsertErrorCatalogEntries: `${moduleName}.upsert-error-catalog-entries`,
    removeErrorCatalogEntries: `${moduleName}.remove-error-catalog-entries`,
    upsertParameterCatalogEntries: `${moduleName}.upsert-parameter-catalog-entries`,
    removeParameterCatalogEntries: `${moduleName}.remove-parameter-catalog-entries`,
} as const
