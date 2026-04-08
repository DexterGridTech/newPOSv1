import type {ValueWithUpdatedAt} from '@impos2/kernel-core-base'
import type {TdpSessionStatus} from '../shared'

// tdpSession slice 描述当前 WebSocket 会话及其与服务端协商出的同步上下文。
export interface TdpSessionState {
  // 当前会话状态机。
  status: ValueWithUpdatedAt<TdpSessionStatus>
  // 最近一次自动重连尝试序号，从 1 开始。
  reconnectAttempt?: ValueWithUpdatedAt<number>
  // 服务端生成的 sessionId。
  sessionId?: ValueWithUpdatedAt<string>
  // 当前连接落到哪个边缘节点。
  nodeId?: ValueWithUpdatedAt<string>
  // 节点健康状态。
  nodeState?: ValueWithUpdatedAt<'healthy' | 'grace' | 'degraded'>
  // 本次连接采用 full 还是 incremental 同步。
  syncMode?: ValueWithUpdatedAt<'incremental' | 'full'>
  // 当前 terminal 在服务端视角下的最高 revision。
  highWatermark?: ValueWithUpdatedAt<number>
  // 会话进入 READY 的时间。
  connectedAt?: ValueWithUpdatedAt<number>
  // 最近一次 PONG 收到的时间。
  lastPongAt?: ValueWithUpdatedAt<number>
  // 服务端建议的替代节点列表。
  alternativeEndpoints?: ValueWithUpdatedAt<string[]>
  // 最近一次断连原因。
  disconnectReason?: ValueWithUpdatedAt<string | null>
}
