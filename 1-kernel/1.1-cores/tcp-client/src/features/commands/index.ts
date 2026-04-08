import {createModuleCommands, defineCommand, type DeviceInfo} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import type {
  TcpBindingContext,
  TcpTaskResultReportRequest,
} from '../../types'

// TCP 客户端命令面只负责控制面流程:
// 激活、续签 credential、以及任务结果上报。
export const kernelCoreTcpClientCommands = createModuleCommands(moduleName, {
  // 初始化后自举 TCP 客户端本地运行时。
  bootstrapTcpClient: defineCommand<void>(),
  bootstrapTcpClientSucceeded: defineCommand<void>(),
  // 使用 activationCode 换取 terminalId 与 credential。
  activateTerminal: defineCommand<{activationCode: string}>(),
  // 激活成功后把关键字段回写给上层调用链。
  activateTerminalSucceeded: defineCommand<{
    terminalId: string
    accessToken: string
    refreshToken: string
    expiresAt: number
    refreshExpiresAt?: number
    binding: TcpBindingContext
    deviceFingerprint: string
    deviceInfo: DeviceInfo
  }>(),
  // 使用 refreshToken 刷新 accessToken。
  refreshCredential: defineCommand<void>(),
  credentialRefreshed: defineCommand<{
    accessToken: string
    expiresAt: number
  }>(),
  // 向控制面回报任务执行结果。
  reportTaskResult: defineCommand<TcpTaskResultReportRequest>(),
  taskResultReported: defineCommand<{instanceId: string; status: string}>(),
  // 清理本地 TCP 身份、凭证和绑定状态。
  resetTcpClient: defineCommand<void>(),
})
