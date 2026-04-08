import type {TdpProjectionEnvelope} from '../shared'

// tdpProjection slice 是本地投影缓存。
// 第一层按 topic 分桶，第二层按 itemKey 定位单条 projection。
export interface TdpProjectionState {
  byTopic: Record<string, Record<string, TdpProjectionEnvelope>>
}
