// 数据面下发到终端的命令项。
export interface TdpCommandInboxItem {
  // 命令唯一 ID，对应服务端 command outbox 记录。
  commandId: string
  // 命令主题。
  topic: string
  // 目标终端 ID。
  terminalId: string
  // 业务命令载荷。
  payload: Record<string, unknown>
  // 来源发布单。
  sourceReleaseId?: string | null
  // 过期时间。
  expiresAt?: string | null
}

// 命令收件箱同时维护 map 与顺序数组，便于查找和按时间倒序展示。
export interface TdpCommandInboxState {
  itemsById: Record<string, TdpCommandInboxItem>
  orderedIds: string[]
}
