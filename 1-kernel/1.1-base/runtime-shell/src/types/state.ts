import type {
    ErrorCatalogEntry,
    ParameterCatalogEntry,
    ProjectionMirrorEnvelope,
    RequestId,
    RequestProjection,
    RuntimeInstanceId,
} from '@impos2/kernel-base-contracts'
import type {RootState} from '@impos2/kernel-base-state-runtime'

export interface RuntimeShellState {
    runtimeId: RuntimeInstanceId
    requestProjections: Record<string, RequestProjection>
    errorCatalog: Record<string, ErrorCatalogEntry>
    parameterCatalog: Record<string, ParameterCatalogEntry>
}

export type RuntimeShellStateSnapshot = Readonly<RuntimeShellState & RootState>

export interface RuntimeReadModel {
    getState(): RuntimeShellStateSnapshot
    hydrate(): Promise<void>
    flush(): Promise<void>
    replaceState(state: RuntimeShellState): void
    setRequestProjection(requestId: RequestId, projection: RequestProjection): void
    applyProjectionMirror(envelope: ProjectionMirrorEnvelope): void
    setErrorCatalogEntry(entry: ErrorCatalogEntry): void
    removeErrorCatalogEntry(key: string): void
    setParameterCatalogEntry(entry: ParameterCatalogEntry): void
    removeParameterCatalogEntry(key: string): void
}
