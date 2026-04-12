import type {HttpRuntime, SocketRuntime} from '@impos2/kernel-base-transport-runtime'
import type {RuntimeModuleInstallContext} from '@impos2/kernel-base-runtime-shell'
import type {SocketConnectionProfile} from '@impos2/kernel-base-transport-runtime'
import type {
    TdpChangesResponse,
    TdpClientMessage,
    TdpServerMessage,
    TdpSnapshotResponse,
} from './protocol'

export interface TdpSyncHttpService {
    getSnapshot(terminalId: string): Promise<TdpSnapshotResponse['data']>
    getChanges(terminalId: string, cursor?: number, limit?: number): Promise<TdpChangesResponse['data']>
}

export interface TdpSyncSocketBinding {
    socketRuntime: SocketRuntime
    profileName: string
    profile?: SocketConnectionProfile<void, {terminalId: string; token: string}, Record<string, string>, TdpServerMessage, TdpClientMessage>
}

export interface TdpSyncRuntimeAssembly {
    createHttpRuntime(context: RuntimeModuleInstallContext): HttpRuntime
    resolveSocketBinding?(context: RuntimeModuleInstallContext): TdpSyncSocketBinding | undefined
}

export interface CreateTdpSyncRuntimeModuleInput {
    assembly?: TdpSyncRuntimeAssembly
    socket?: {
        reconnectAttempts?: number
    }
}

export interface TdpTopicDataChangeItem {
    operation: 'upsert' | 'delete'
    itemKey: string
    payload?: Record<string, unknown>
    revision?: number
}

export interface TdpTopicDataChangedPayload {
    topic: string
    changes: readonly TdpTopicDataChangeItem[]
}
