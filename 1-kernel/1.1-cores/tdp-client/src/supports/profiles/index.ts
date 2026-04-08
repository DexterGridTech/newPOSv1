import {SERVER_NAME_MOCK_TERMINAL_PLATFORM_API} from '@impos2/kernel-server-config'
import {defineSocketProfile, typed} from '@impos2/kernel-core-communication'
import type {TdpClientMessage, TdpServerMessage} from '../../types'

export const tdpSocketProfile = defineSocketProfile<
  {terminalId: string; token: string},
  Record<string, string>,
  TdpServerMessage,
  TdpClientMessage
>({
  name: 'tdpClient.session',
  serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM_API,
  pathTemplate: '/api/v1/tdp/ws/connect',
  handshake: {
    query: typed<{terminalId: string; token: string}>('TdpSocketQuery'),
    headers: typed<Record<string, string>>('TdpSocketHeaders'),
  },
  messages: {
    incoming: typed<TdpServerMessage>('TdpServerMessage'),
    outgoing: typed<TdpClientMessage>('TdpClientMessage'),
  },
  meta: {
    heartbeatTimeoutMs: 30_000,
    // TDP 会话默认持续保活，除非显式执行 disconnectTdpSession。
    reconnectAttempts: -1,
    reconnectIntervalMs: 1_000,
  },
})
