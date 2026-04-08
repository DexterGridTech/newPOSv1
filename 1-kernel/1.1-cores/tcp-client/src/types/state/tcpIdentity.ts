import type {DeviceInfo, ValueWithUpdatedAt} from '@impos2/kernel-core-base'
import type {TcpActivationStatus} from '../shared'

// tcpIdentity slice 保存“这台设备是谁”以及“是否已经在控制面激活”。
export interface TcpIdentityState {
  // 当前设备稳定指纹。
  deviceFingerprint?: ValueWithUpdatedAt<string>
  // 当前设备描述信息，通常由 base.device 提供。
  deviceInfo?: ValueWithUpdatedAt<DeviceInfo>
  // 控制面分配的终端 ID。
  terminalId?: ValueWithUpdatedAt<string>
  // 激活状态机。
  activationStatus: ValueWithUpdatedAt<TcpActivationStatus>
  // 本地记录的激活完成时间。
  activatedAt?: ValueWithUpdatedAt<number>
}
