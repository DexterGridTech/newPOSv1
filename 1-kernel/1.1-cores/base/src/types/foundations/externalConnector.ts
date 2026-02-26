/** 通道类型 */
export type ChannelType =
    | 'INTENT'
    | 'AIDL'
    | 'USB'
    | 'SERIAL'
    | 'BLUETOOTH'
    | 'NETWORK'
    | 'SDK'

/** 交互模式 */
export type InteractionMode = 'request-response' | 'stream' | 'passive'

/** 通道描述符（唯一标识一个连接目标） */
export interface ChannelDescriptor {
    type: ChannelType
    /** 包名 / 设备路径 / MAC 地址 / URL */
    target: string
    mode: InteractionMode
    /** 通道专属配置：波特率、UUID 等 */
    options?: Record<string, any>
}

/** 标准事件载荷（Stream / Passive 模式推送） */
export interface ConnectorEvent<T = any> {
    /** subscribe() 返回的通道 ID */
    channelId: string
    type: ChannelType
    target: string
    /** null 表示错误事件（硬件断开、IO 异常等） */
    data: T | null
    timestamp: number
    /** 原始 hex/bytes 或错误信息，调试用 */
    raw?: string
}

/** 标准响应（Request-Response 模式） */
export interface ConnectorResponse<T = any> {
    success: boolean
    code: number
    message: string
    data?: T
    duration: number
    timestamp: number
}
