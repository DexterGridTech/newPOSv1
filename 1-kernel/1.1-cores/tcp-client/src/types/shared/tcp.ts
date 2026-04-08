import type {DeviceInfo, ValueWithUpdatedAt} from '@impos2/kernel-core-base'

// 控制面激活生命周期。FAILED 主要用于保留失败态给 UI 或日志层消费。
export type TcpActivationStatus = 'UNACTIVATED' | 'ACTIVATING' | 'ACTIVATED' | 'FAILED'

// 当前终端凭证的本地可用状态，不等同于服务端 credential 记录本身。
export type TcpCredentialStatus = 'EMPTY' | 'READY' | 'REFRESHING' | 'EXPIRED'

// 终端在控制面完成激活后携带的绑定上下文。
// 这些字段决定了终端属于哪个平台/租户/品牌/项目/门店及采用哪套 profile/template。
export interface TcpBindingContext {
  // 平台 ID，通常代表顶层业务平台或产品线。
  platformId?: string
  // 租户 ID，用于区分商户或独立租户空间。
  tenantId?: string
  // 品牌 ID，用于标识品牌归属。
  brandId?: string
  // 项目 ID，用于标识项目或业务实例。
  projectId?: string
  // 门店 ID，是终端最终绑定到的经营实体。
  storeId?: string
  // Profile ID，描述终端能力、机型或功能档位。
  profileId?: string
  // Template ID，描述初始化配置模板。
  templateId?: string
}

// 激活请求使用一次性 activationCode 换取 terminalId 与 credential。
export interface TcpActivationRequest {
  // 一次性激活码，由控制面后台签发。
  activationCode: string
  // 设备稳定指纹，用于识别同一物理终端。
  deviceFingerprint: string
  // 设备描述信息，会被服务端记录到 terminal.deviceInfo。
  deviceInfo: Record<string, unknown>
}

// 激活成功后返回的控制面身份与凭证。
export interface TcpActivationResponse {
  // 终端在控制面中的唯一身份。
  terminalId: string
  // 短期 access token，用于后续 TDP/TCP 访问。
  token: string
  // 长期 refresh token，用于续签 access token。
  refreshToken: string
  // access token 距当前的剩余有效秒数。
  expiresIn: number
  // refresh token 距当前的剩余有效秒数。
  refreshExpiresIn?: number
  // 激活完成后下发的绑定上下文。
  binding?: TcpBindingContext
}

export interface TcpRefreshCredentialRequest {
  // 用于刷新 access token 的长期凭证。
  refreshToken: string
}

export interface TcpRefreshCredentialResponse {
  // 新签发的 access token。
  token: string
  // 新 token 距当前的剩余有效秒数。
  expiresIn: number
}

// 终端通过 TCP 上报任务结果时使用的请求体。
export interface TcpTaskResultReportRequest {
  // 冗余 terminalId，允许调用方显式指定；运行时也可从本地 identity 推导。
  terminalId: string
  // 任务实例 ID，对应服务端 task_instances.instance_id。
  instanceId: string
  // 任务执行状态，如 COMPLETED / FAILED。
  status: string
  // 成功结果载荷，结构由具体任务决定。
  result?: unknown
  // 失败错误载荷，结构由具体任务决定。
  error?: unknown
}

export interface TcpTaskResultReportResponse {
  // 被成功回写的任务实例 ID。
  instanceId: string
  // 服务端最终记录的任务状态。
  status: string
  // 服务端写入 finishedAt 后的时间戳。
  finishedAt?: number
}

// identity slice 对外暴露的扁平快照，方便业务代码消费。
export interface TcpIdentitySnapshot {
  // 终端控制面身份，激活成功后存在。
  terminalId?: string
  // 当前设备稳定指纹。
  deviceFingerprint?: string
  // 当前设备描述信息。
  deviceInfo?: DeviceInfo
  // 当前激活生命周期状态。
  activationStatus: TcpActivationStatus
  // 本地记录的激活完成时间。
  activatedAt?: number
}

// credential slice 对外暴露的扁平快照。
export interface TcpCredentialSnapshot {
  // 当前 access token。
  accessToken?: string
  // 当前 refresh token。
  refreshToken?: string
  // access token 在本地换算后的绝对过期时间。
  expiresAt?: number
  // refresh token 在本地换算后的绝对过期时间。
  refreshExpiresAt?: number
  // 本地凭证状态机。
  status: TcpCredentialStatus
  // 最近一次 credential 被写入的时间。
  updatedAt?: number
}

// 需要持久化到本地存储的 TCP 客户端整体快照。
export interface TcpPersistedSnapshot {
  identity: TcpIdentitySnapshot
  credential: TcpCredentialSnapshot
  binding: TcpBindingContext
}

// 通用的 value-with-updatedAt map，主要用于需要按 key 存放时间戳值的场景。
export interface TcpValueMap<T> {
  [key: string]: ValueWithUpdatedAt<T> | undefined
}
