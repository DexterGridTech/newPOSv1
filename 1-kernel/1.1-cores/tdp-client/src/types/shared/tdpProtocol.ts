// 终端在数据面侧的连接状态机。
export type TdpSessionStatus =
  | 'IDLE'
  | 'CONNECTING'
  | 'RECONNECTING'
  | 'HANDSHAKING'
  | 'READY'
  | 'DEGRADED'
  | 'REHOME_REQUIRED'
  | 'DISCONNECTED'
  | 'ERROR'

// 投影消息的统一信封。
// topic + itemKey 共同决定本地投影中的唯一项。
export interface TdpProjectionEnvelope {
  // 主题名，例如 config.delta / tcp.task.release / remote.control。
  topic: string
  // 主题内唯一键，客户端通常用它作为去重和覆盖写入的 key。
  itemKey: string
  // 当前投影的语义操作。
  operation: 'upsert' | 'delete'
  // 作用域类型，当前服务端主要使用 TERMINAL。
  scopeType: string
  // 作用域 ID，通常就是 terminalId。
  scopeId: string
  // 单主题单作用域内递增 revision。
  revision: number
  // 业务载荷本体。
  payload: Record<string, unknown>
  // 该投影变化在服务端发生的时间。
  occurredAt: string
  // 可选的来源发布单 ID，用于把数据面变化追溯回控制面动作。
  sourceReleaseId?: string | null
}

// 终端发往 TDP 服务端的消息协议。
export type TdpClientMessage =
  | {
      type: 'HANDSHAKE'
      data: {
        // 当前终端 ID，必须与 URL query 中的 terminalId 一致。
        terminalId: string
        // 客户端版本号，服务端会记录在 session 中。
        appVersion: string
        // 客户端本地已处理到的 revision 游标，用于决定全量还是增量同步。
        lastCursor?: number
        // 协议版本，当前默认 1.0。
        protocolVersion?: string
        // 可选能力声明，供服务端做兼容扩展。
        capabilities?: string[]
        // 可选订阅主题，用于未来按 topic 缩小推送范围。
        subscribedTopics?: string[]
      }
    }
  | {
      type: 'PING'
    }
  | {
      type: 'STATE_REPORT'
      data: {
        // 客户端本地已应用到的最新增量 cursor。
        lastAppliedCursor?: number
        // 可选连接指标，当前仅透传给服务端。
        connectionMetrics?: Record<string, unknown>
        // 可选本地存储或投影指标。
        localStoreMetrics?: Record<string, unknown>
      }
    }
  | {
      type: 'ACK'
      data: {
        // 本次 ACK 覆盖到的增量 cursor。
        cursor: number
        // 可选 topic，帮助服务端做业务态回写。
        topic?: string
        // 可选投影项 key 或 commandId。
        itemKey?: string
        // 当 ACK 关联 task instance 时可显式带上 instanceId。
        instanceId?: string
      }
    }

// 服务端发往终端的消息协议。
export type TdpServerMessage =
  | {
      type: 'SESSION_READY'
      data: {
        // 服务端生成的 sessionId。
        sessionId: string
        // 当前处理该连接的边缘节点 ID。
        nodeId: string
        // 节点健康状态。
        nodeState: 'healthy' | 'grace' | 'degraded'
        // 当前 terminal 的最高增量 cursor 水位。
        highWatermark: number
        // 本次连接采用 full 还是 incremental 同步。
        syncMode: 'incremental' | 'full'
        // 服务端建议的替代节点地址。
        alternativeEndpoints: string[]
      }
    }
  | {
      type: 'FULL_SNAPSHOT'
      data: {
        // 快照所属 terminalId。
        terminalId: string
        // 全量投影集。
        snapshot: TdpProjectionEnvelope[]
        // 快照对应的最高增量 cursor。
        highWatermark: number
      }
    }
  | {
      type: 'CHANGESET'
      data: {
        terminalId: string
        // 从 cursor 之后到当前窗口内的增量变化。
        changes: TdpProjectionEnvelope[]
        // 本批变化之后的下一游标。
        nextCursor: number
        // 是否还有更多增量未下发。
        hasMore: boolean
        highWatermark: number
      }
    }
  | {
      type: 'PROJECTION_CHANGED'
      eventId: string
      timestamp: number
      data: {
        cursor: number
        change: TdpProjectionEnvelope
      }
    }
  | {
      type: 'PROJECTION_BATCH'
      eventId: string
      timestamp: number
      data: {
        changes: TdpProjectionEnvelope[]
        nextCursor: number
      }
    }
  | {
      type: 'COMMAND_DELIVERED'
      eventId: string
      timestamp: number
      data: {
        // 服务端 command outbox 中的唯一命令 ID。
        commandId: string
        // 命令所属主题，例如 remote.control / print.command。
        topic: string
        terminalId: string
        // 命令载荷。
        payload: Record<string, unknown>
        // 命令来源发布单。
        sourceReleaseId?: string | null
        // 命令过期时间。
        expiresAt?: string | null
      }
    }
  | {
      type: 'PONG'
      data: {
        timestamp: number
      }
    }
  | {
      type: 'EDGE_DEGRADED'
      data: {
        reason: string
        issuedAt: string
        nodeState: 'healthy' | 'grace' | 'degraded'
        gracePeriodSeconds: number
        alternativeEndpoints: string[]
      }
    }
  | {
      type: 'SESSION_REHOME_REQUIRED'
      data: {
        reason: string
        deadline: string
        alternativeEndpoints: string[]
      }
    }
  | {
      type: 'ERROR'
      error: {
        // 协议错误码。
        code: string
        // 面向客户端的错误描述。
        message: string
        // 可选调试明细。
        details?: unknown
      }
    }

// HTTP 快照接口响应，沿用 mock-terminal-platform 的 {success,data,error} 包装。
export interface TdpSnapshotResponse {
  success: boolean
  data: TdpProjectionEnvelope[]
  error?: {
    message: string
    details?: unknown
  }
}

// HTTP 增量接口响应。
export interface TdpChangesResponse {
  success: boolean
  data: {
    terminalId: string
    changes: TdpProjectionEnvelope[]
    nextCursor: number
    hasMore: boolean
    highWatermark: number
  }
  error?: {
    message: string
    details?: unknown
  }
}
