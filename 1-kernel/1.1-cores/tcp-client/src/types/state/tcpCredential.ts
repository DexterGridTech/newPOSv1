import type {ValueWithUpdatedAt} from '@impos2/kernel-core-base'
import type {TcpCredentialStatus} from '../shared'

// tcpCredential slice 保存当前终端可用的控制面凭证。
export interface TcpCredentialState {
  // 当前 access token。
  accessToken?: ValueWithUpdatedAt<string>
  // 当前 refresh token。
  refreshToken?: ValueWithUpdatedAt<string>
  // access token 的本地绝对过期时间。
  expiresAt?: ValueWithUpdatedAt<number>
  // refresh token 的本地绝对过期时间。
  refreshExpiresAt?: ValueWithUpdatedAt<number>
  // 本地凭证状态机。
  status: ValueWithUpdatedAt<TcpCredentialStatus>
  // 最近一次写入 credential 的时间。
  updatedAt?: ValueWithUpdatedAt<number>
}
