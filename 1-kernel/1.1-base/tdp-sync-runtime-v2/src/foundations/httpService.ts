import {
    createHttpServiceBinder,
    createModuleHttpEndpointFactory,
    type HttpRuntime,
} from '@next/kernel-base-transport-runtime'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@next/kernel-server-config-v2'
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

const toSubscriptionQuery = (options?: {
    subscribedTopics?: readonly string[]
    subscriptionHash?: string
}) => ({
    subscribedTopics: options?.subscribedTopics == null
        ? undefined
        : [...options.subscribedTopics].sort().join(','),
    subscriptionHash: options?.subscriptionHash,
})

const snapshotEndpoint = defineEndpoint<
    {terminalId: string},
    {sandboxId: string; subscribedTopics?: string; subscriptionHash?: string},
    void,
    TdpSnapshotResponse
>('get-snapshot', {
    method: 'GET',
    pathTemplate: '/api/v1/tdp/terminals/{terminalId}/snapshot',
    request: {
        path: true,
        query: true,
    },
})

const changesEndpoint = defineEndpoint<
    {terminalId: string},
    {sandboxId: string; cursor?: number; limit?: number; subscribedTopics?: string; subscriptionHash?: string},
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

export const createTdpSyncHttpServiceV2 = (runtime: HttpRuntime): TdpSyncHttpServiceV2 => {
    const http = createHttpServiceBinder(runtime)

    return {
        async getSnapshot(sandboxId, terminalId, options) {
            return http.envelope(snapshotEndpoint, {
                path: {terminalId},
                query: {
                    sandboxId,
                    ...toSubscriptionQuery(options),
                },
            }, {
                errorDefinition: tdpSyncV2ErrorDefinitions.protocolError,
                fallbackMessage: TDP_SYNC_V2_SNAPSHOT_FALLBACK_MESSAGE,
            })
        },
        async getChanges(sandboxId, terminalId, cursor = 0, limit, options) {
            return http.envelope(changesEndpoint, {
                path: {terminalId},
                query: {
                    sandboxId,
                    cursor,
                    limit,
                    ...toSubscriptionQuery(options),
                },
            }, {
                errorDefinition: tdpSyncV2ErrorDefinitions.protocolError,
                fallbackMessage: TDP_SYNC_V2_CHANGES_FALLBACK_MESSAGE,
            })
        },
    }
}
