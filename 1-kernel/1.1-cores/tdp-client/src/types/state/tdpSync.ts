import type {ValueWithUpdatedAt} from '@impos2/kernel-core-base'

// tdpSync slice 记录投影同步过程中的关键游标和阶段。
// 这里的 lastCursor / lastAppliedRevision 是跨重启恢复增量同步的最小真相源，
// 因此需要持久化；projection raw 数据本身则只保留在运行时内存中。
export interface TdpSyncState {
  // 全量快照拉取状态。
  snapshotStatus: ValueWithUpdatedAt<'idle' | 'loading' | 'ready' | 'error'>
  // 增量追平状态。
  changesStatus: ValueWithUpdatedAt<'idle' | 'catching-up' | 'ready' | 'error'>
  // 最近一次确认已经追到的增量 cursor。
  lastCursor?: ValueWithUpdatedAt<number>
  // 最近一次从服务端收到的 revision。
  lastDeliveredRevision?: ValueWithUpdatedAt<number>
  // 最近一次成功 ACK 给服务端的 revision。
  lastAckedRevision?: ValueWithUpdatedAt<number>
  // 最近一次确认已在本地真正应用完成的 revision。
  lastAppliedRevision?: ValueWithUpdatedAt<number>
}
