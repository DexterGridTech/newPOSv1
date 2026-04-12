import {defineSocketProfile, JsonSocketCodec, typed} from '@impos2/kernel-base-transport-runtime'
import type {TdpClientMessage, TdpServerMessage} from '../types'

export const TDP_SYNC_V2_SOCKET_PROFILE_NAME = 'kernel.base.tdp-sync-runtime-v2.socket'

export const tdpSyncV2SocketProfile = defineSocketProfile<
    void,
    {terminalId: string; token: string},
    Record<string, string>,
    TdpServerMessage,
    TdpClientMessage
>({
    name: TDP_SYNC_V2_SOCKET_PROFILE_NAME,
    serverName: 'mock-terminal-platform',
    pathTemplate: '/api/v1/tdp/ws/connect',
    handshake: {
        query: typed<{terminalId: string; token: string}>('kernel.base.tdp-sync-runtime-v2.socket.query'),
        headers: typed<Record<string, string>>('kernel.base.tdp-sync-runtime-v2.socket.headers'),
    },
    messages: {
        incoming: typed<TdpServerMessage>('kernel.base.tdp-sync-runtime-v2.socket.incoming'),
        outgoing: typed<TdpClientMessage>('kernel.base.tdp-sync-runtime-v2.socket.outgoing'),
    },
    codec: new JsonSocketCodec<TdpServerMessage, TdpClientMessage>(),
    meta: {
        reconnectAttempts: 0,
    },
})
