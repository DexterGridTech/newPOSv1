import type {
    HttpRuntime,
    SocketConnectionProfile,
    SocketRuntime,
} from '@next/kernel-base-transport-runtime'
import type {RuntimeModuleContextV2} from '@next/kernel-base-runtime-shell-v2'
import type {HotUpdatePort} from '@next/kernel-base-platform-ports'
import type {
    TdpChangesResponse,
    TdpClientMessage,
    TdpServerMessage,
    TdpSnapshotResponse,
} from './protocol'
import type {HotUpdateCurrentFacts} from './hotUpdate'
import type {CommandIntent} from '@next/kernel-base-runtime-shell-v2'

export interface TdpTopicDataChangeItem {
    operation: 'upsert' | 'delete'
    itemKey: string
    payload?: Record<string, unknown>
    revision?: number
    scopeType?: string
    scopeId?: string
    sourceReleaseId?: string | null
    occurredAt?: string
    scopeMetadata?: Record<string, unknown>
}

export interface TdpTopicDataChangedPayload {
    topic: string
    changes: readonly TdpTopicDataChangeItem[]
}

export interface TdpSyncHttpServiceV2 {
    getSnapshot(
        sandboxId: string,
        terminalId: string,
        options?: {
            subscribedTopics?: readonly string[]
            subscriptionHash?: string
        },
    ): Promise<TdpSnapshotResponse['data']>
    getChanges(
        sandboxId: string,
        terminalId: string,
        cursor?: number,
        limit?: number,
        options?: {
            subscribedTopics?: readonly string[]
            subscriptionHash?: string
        },
    ): Promise<TdpChangesResponse['data']>
}

export interface TdpSyncHttpServiceRefV2 {
    current?: TdpSyncHttpServiceV2
}

export interface TdpSyncSocketBindingV2 {
    socketRuntime: SocketRuntime
    profileName: string
    profile?: SocketConnectionProfile<void, {sandboxId: string; terminalId: string; token: string}, Record<string, string>, TdpServerMessage, TdpClientMessage>
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
    sendBatchAck(payload: {
        nextCursor: number
        batchId?: string
        processingLagMs?: number
        subscriptionHash?: string
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
    autoConnectOnActivation?: boolean
    socket?: {
        reconnectAttempts?: number
        reconnectIntervalMs?: number
    }
    hotUpdate?: {
        getPort?(context: RuntimeModuleContextV2): HotUpdatePort | undefined
        getCurrentFacts?(context: Pick<RuntimeModuleContextV2, 'displayContext' | 'getState'>): HotUpdateCurrentFacts | undefined
        downloadRetryDelayMs?: number
        createRestartPreparationCommand?(input: {
            context: RuntimeModuleContextV2
            displayIndex: number
            releaseId: string
            packageId: string
            bundleVersion: string
            mode: 'immediate' | 'idle'
        }): CommandIntent<{
            displayIndex: number
            releaseId: string
            packageId: string
            bundleVersion: string
            mode: 'immediate' | 'idle'
        }>
    }
}
