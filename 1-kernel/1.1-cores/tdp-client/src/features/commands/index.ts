import {createModuleCommands, defineCommand, type IAppError} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import type {
  TdpCommandInboxItem,
  TdpProjectionEnvelope,
  TdpServerMessage,
} from '../../types'

// TDP 客户端命令面覆盖了:
// 连接管理、协议消息分发、投影同步、ACK/STATE_REPORT 以及控制信号处理。
export const kernelCoreTdpClientCommands = createModuleCommands(moduleName, {
  bootstrapTdpClient: defineCommand<void>(),
  bootstrapTdpClientSucceeded: defineCommand<void>(),
  // 使用 tcp-client 中的 terminalId/accessToken 建立 TDP WebSocket 会话。
  connectTdpSession: defineCommand<void>(),
  disconnectTdpSession: defineCommand<void>(),
  // 以下几个命令由 socket runtime 事件桥接产生。
  tdpSocketConnected: defineCommand<void>(),
  tdpSocketReconnecting: defineCommand<{attempt: number}>(),
  tdpSocketDisconnected: defineCommand<{reason?: string}>(),
  tdpSocketErrored: defineCommand<{error: unknown}>(),
  tdpSocketHeartbeatTimedOut: defineCommand<void>(),
  tdpMessageReceived: defineCommand<TdpServerMessage>(),
  // 以下几个命令把协议消息拆解成更细的业务动作。
  tdpSessionReady: defineCommand<Extract<TdpServerMessage, {type: 'SESSION_READY'}>['data']>(),
  tdpSnapshotLoaded: defineCommand<{
    snapshot: TdpProjectionEnvelope[]
    highWatermark: number
  }>(),
  tdpChangesLoaded: defineCommand<{
    changes: TdpProjectionEnvelope[]
    nextCursor: number
    hasMore: boolean
    highWatermark: number
  }>(),
  tdpProjectionReceived: defineCommand<{
    change: TdpProjectionEnvelope
    cursor: number
  }>(),
  tdpProjectionBatchReceived: defineCommand<{
    changes: TdpProjectionEnvelope[]
    nextCursor: number
  }>(),
  tdpCommandDelivered: defineCommand<TdpCommandInboxItem>(),
  tdpPongReceived: defineCommand<{timestamp: number}>(),
  tdpEdgeDegraded: defineCommand<Extract<TdpServerMessage, {type: 'EDGE_DEGRADED'}>['data']>(),
  tdpSessionRehomeRequired: defineCommand<Extract<TdpServerMessage, {type: 'SESSION_REHOME_REQUIRED'}>['data']>(),
  tdpProtocolFailed: defineCommand<{error: IAppError}>(),
  // 主动发往服务端的客户端消息。
  acknowledgeCursor: defineCommand<{
    cursor: number
    topic?: string
    itemKey?: string
    instanceId?: string
  }>(),
  reportAppliedCursor: defineCommand<{
    cursor: number
    connectionMetrics?: Record<string, unknown>
    localStoreMetrics?: Record<string, unknown>
  }>(),
  sendPing: defineCommand<void>(),
})
