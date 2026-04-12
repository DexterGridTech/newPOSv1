import {
    callHttpEnvelope,
    createModuleHttpEndpointFactory,
    type HttpRuntime,
} from '@impos2/kernel-base-transport-runtime'
import {moduleName} from '../moduleName'
import {tdpSyncV2ErrorDefinitions} from '../supports'
import type {
    TdpChangesResponse,
    TdpSnapshotResponse,
    TdpSyncHttpServiceV2,
} from '../types'

const MOCK_TERMINAL_PLATFORM_SERVER = 'mock-terminal-platform'

const defineEndpoint = createModuleHttpEndpointFactory(moduleName, MOCK_TERMINAL_PLATFORM_SERVER)

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
            fallbackMessage: 'get snapshot failed',
        })
    },
    async getChanges(terminalId, cursor = 0, limit) {
        return callHttpEnvelope(runtime, changesEndpoint, {
            path: {terminalId},
            query: {cursor, limit},
        }, {
            errorDefinition: tdpSyncV2ErrorDefinitions.protocolError,
            fallbackMessage: 'get changes failed',
        })
    },
})
