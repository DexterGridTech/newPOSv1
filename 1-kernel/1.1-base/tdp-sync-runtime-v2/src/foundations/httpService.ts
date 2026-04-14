import {
    callHttpEnvelope,
    createModuleHttpEndpointFactory,
    type HttpRuntime,
} from '@impos2/kernel-base-transport-runtime'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@impos2/kernel-server-config-v2'
import {moduleName} from '../moduleName'
import {tdpSyncV2ErrorDefinitions} from '../supports'
import type {
    TdpChangesResponse,
    TdpSnapshotResponse,
    TdpSyncHttpServiceV2,
} from '../types'

const TDP_SYNC_V2_SNAPSHOT_FALLBACK_MESSAGE = 'tdp snapshot request failed'
const TDP_SYNC_V2_CHANGES_FALLBACK_MESSAGE = 'tdp changes request failed'

const defineEndpoint = createModuleHttpEndpointFactory(moduleName, SERVER_NAME_MOCK_TERMINAL_PLATFORM)

const snapshotEndpoint = defineEndpoint<
    {terminalId: string},
    void,
    void,
    TdpSnapshotResponse
>('get-snapshot', {
    method: 'GET',
    pathTemplate: '/api/v1/tdp/terminals/{terminalId}/snapshot',
    request: {
        path: true,
    },
})

const changesEndpoint = defineEndpoint<
    {terminalId: string},
    {cursor?: number; limit?: number},
    void,
    TdpChangesResponse
>('get-changes', {
    method: 'GET',
    pathTemplate: '/api/v1/tdp/terminals/{terminalId}/changes',
    request: {
        path: true,
        query: true,
    },
})

export const createTdpSyncHttpServiceV2 = (runtime: HttpRuntime): TdpSyncHttpServiceV2 => ({
    async getSnapshot(terminalId) {
        return callHttpEnvelope(runtime, snapshotEndpoint, {
            path: {terminalId},
        }, {
            errorDefinition: tdpSyncV2ErrorDefinitions.protocolError,
            fallbackMessage: TDP_SYNC_V2_SNAPSHOT_FALLBACK_MESSAGE,
        })
    },
    async getChanges(terminalId, cursor = 0, limit) {
        return callHttpEnvelope(runtime, changesEndpoint, {
            path: {terminalId},
            query: {cursor, limit},
        }, {
            errorDefinition: tdpSyncV2ErrorDefinitions.protocolError,
            fallbackMessage: TDP_SYNC_V2_CHANGES_FALLBACK_MESSAGE,
        })
    },
})
