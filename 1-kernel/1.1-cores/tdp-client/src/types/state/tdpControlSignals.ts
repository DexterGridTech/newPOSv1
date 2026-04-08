import type {IAppError, ValueWithUpdatedAt} from '@impos2/kernel-core-base'
import type {TdpServerMessage} from '../shared'

// tdpControlSignals slice 保存协议层控制信号，便于 UI、日志或调试工具直接观察。
export interface TdpControlSignalsState {
  // 最近一次协议错误。
  lastProtocolError?: ValueWithUpdatedAt<IAppError | null>
  // 最近一次 EDGE_DEGRADED 信号。
  lastEdgeDegraded?: ValueWithUpdatedAt<Extract<TdpServerMessage, {type: 'EDGE_DEGRADED'}>['data'] | null>
  // 最近一次 SESSION_REHOME_REQUIRED 信号。
  lastRehomeRequired?: ValueWithUpdatedAt<Extract<TdpServerMessage, {type: 'SESSION_REHOME_REQUIRED'}>['data'] | null>
  // 最近一次断连原因。
  lastDisconnectReason?: ValueWithUpdatedAt<string | null>
}
