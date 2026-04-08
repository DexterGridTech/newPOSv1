import {SERVER_NAME_MOCK_TERMINAL_PLATFORM_API} from '@impos2/kernel-server-config'
import {defineHttpEndpoint, typed} from '@impos2/kernel-core-communication'
import type {TdpChangesResponse, TdpSnapshotResponse} from '../../types'

export const kernelCoreTdpClientApis = {
  getSnapshot: defineHttpEndpoint<{terminalId: string}, void, void, TdpSnapshotResponse>({
    name: 'tdpClient.getSnapshot',
    serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM_API,
    method: 'GET',
    pathTemplate: '/api/v1/tdp/terminals/{terminalId}/snapshot',
    request: {
      path: typed<{terminalId: string}>('TdpSnapshotPath'),
    },
    response: typed<TdpSnapshotResponse>('TdpSnapshotResponse'),
  }),
  getChanges: defineHttpEndpoint<{terminalId: string}, {cursor?: number; limit?: number}, void, TdpChangesResponse>({
    name: 'tdpClient.getChanges',
    serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM_API,
    method: 'GET',
    pathTemplate: '/api/v1/tdp/terminals/{terminalId}/changes',
    request: {
      path: typed<{terminalId: string}>('TdpChangesPath'),
      query: typed<{cursor?: number; limit?: number}>('TdpChangesQuery'),
    },
    response: typed<TdpChangesResponse>('TdpChangesResponse'),
  }),
}
