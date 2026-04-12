import {createAppError} from '@impos2/kernel-base-contracts'
import {
    defineHttpEndpoint,
    normalizeTransportError,
    typed,
    type HttpRuntime,
} from '@impos2/kernel-base-transport-runtime'
import {tdpSyncErrorDefinitions} from '../supports'
import type {
    TdpChangesResponse,
    TdpSnapshotResponse,
    TdpSyncHttpService,
} from '../types'

const MOCK_TERMINAL_PLATFORM_SERVER = 'mock-terminal-platform'

const snapshotEndpoint = defineHttpEndpoint<
    {terminalId: string},
    void,
    void,
    TdpSnapshotResponse
>({
    name: 'kernel.base.tdp-sync-runtime.get-snapshot',
    serverName: MOCK_TERMINAL_PLATFORM_SERVER,
    method: 'GET',
    pathTemplate: '/api/v1/tdp/terminals/{terminalId}/snapshot',
    request: {
        path: typed<{terminalId: string}>('kernel.base.tdp-sync-runtime.get-snapshot.path'),
    },
    response: typed<TdpSnapshotResponse>('kernel.base.tdp-sync-runtime.get-snapshot.response'),
})

const changesEndpoint = defineHttpEndpoint<
    {terminalId: string},
    {cursor?: number; limit?: number},
    void,
    TdpChangesResponse
>({
    name: 'kernel.base.tdp-sync-runtime.get-changes',
    serverName: MOCK_TERMINAL_PLATFORM_SERVER,
    method: 'GET',
    pathTemplate: '/api/v1/tdp/terminals/{terminalId}/changes',
    request: {
        path: typed<{terminalId: string}>('kernel.base.tdp-sync-runtime.get-changes.path'),
        query: typed<{cursor?: number; limit?: number}>('kernel.base.tdp-sync-runtime.get-changes.query'),
    },
    response: typed<TdpChangesResponse>('kernel.base.tdp-sync-runtime.get-changes.response'),
})

export const createTdpSyncHttpService = (runtime: HttpRuntime): TdpSyncHttpService => {
    return {
        async getSnapshot(terminalId) {
            try {
                const response = await runtime.call(snapshotEndpoint, {
                    path: {terminalId},
                })
                if (!response.data.success) {
                    throw createAppError(tdpSyncErrorDefinitions.protocolError, {
                        args: {error: response.data.error?.message ?? 'get snapshot failed'},
                        details: response.data.error,
                    })
                }
                return response.data.data
            } catch (error) {
                const normalized = normalizeTransportError(error)
                throw createAppError(tdpSyncErrorDefinitions.protocolError, {
                    args: {error: normalized.message},
                    details: normalized,
                    cause: normalized,
                })
            }
        },
        async getChanges(terminalId, cursor = 0, limit) {
            try {
                const response = await runtime.call(changesEndpoint, {
                    path: {terminalId},
                    query: {cursor, limit},
                })
                if (!response.data.success) {
                    throw createAppError(tdpSyncErrorDefinitions.protocolError, {
                        args: {error: response.data.error?.message ?? 'get changes failed'},
                        details: response.data.error,
                    })
                }
                return response.data.data
            } catch (error) {
                const normalized = normalizeTransportError(error)
                throw createAppError(tdpSyncErrorDefinitions.protocolError, {
                    args: {error: normalized.message},
                    details: normalized,
                    cause: normalized,
                })
            }
        },
    }
}
