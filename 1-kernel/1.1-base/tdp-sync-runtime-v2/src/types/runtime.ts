import type {
    HttpRuntime,
    SocketConnectionProfile,
    SocketRuntime,
} from '@impos2/kernel-base-transport-runtime'
import type {RuntimeModuleContextV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {
    TdpChangesResponse,
    TdpClientMessage,
    TdpServerMessage,
    TdpSnapshotResponse,
} from './protocol'

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

export interface TdpSyncHttpServiceV2 {
    getSnapshot(terminalId: string): Promise<TdpSnapshotResponse['data']>
    getChanges(terminalId: string, cursor?: number, limit?: number): Promise<TdpChangesResponse['data']>
}

export interface TdpSyncSocketBindingV2 {
    socketRuntime: SocketRuntime
    profileName: string
    profile?: SocketConnectionProfile<void, {terminalId: string; token: string}, Record<string, string>, TdpServerMessage, TdpClientMessage>
}

export interface TdpSyncRuntimeAssemblyV2 {
    createHttpRuntime(context: RuntimeModuleContextV2): HttpRuntime
    resolveSocketBinding?(context: RuntimeModuleContextV2): TdpSyncSocketBindingV2 | undefined
}

export interface TdpSessionConnectionRuntimeV2 {
    startSocketConnection(options?: {isReconnect?: boolean}): Promise<Record<string, unknown>>
    disconnect(reason?: string): void
    sendAck(payload: {
        cursor: number
        topic?: string
        itemKey?: string
        instanceId?: string
    }): void
    sendStateReport(payload: {
        cursor: number
        connectionMetrics?: Record<string, unknown>
        localStoreMetrics?: Record<string, unknown>
    }): void
    sendPing(): void
}

export interface TdpSessionConnectionRuntimeRefV2 {
    current?: TdpSessionConnectionRuntimeV2
}

export interface CreateTdpSyncRuntimeModuleV2Input {
    assembly?: TdpSyncRuntimeAssemblyV2
    socket?: {
        reconnectAttempts?: number
        reconnectIntervalMs?: number
    }
}
