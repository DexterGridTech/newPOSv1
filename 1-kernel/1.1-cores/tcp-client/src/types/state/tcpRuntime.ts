import type {IAppError, ValueWithUpdatedAt} from '@impos2/kernel-core-base'

// tcpRuntime slice 保存运行时元信息，便于调试与 dev 验证。
export interface TcpRuntimeState {
  // 是否完成过 bootstrap。
  bootstrapped: ValueWithUpdatedAt<boolean>
  // 最近一次 activateTerminal 命令 ID。
  lastActivationRequestId?: ValueWithUpdatedAt<string>
  // 最近一次 refreshCredential 命令 ID。
  lastRefreshRequestId?: ValueWithUpdatedAt<string>
  // 最近一次 reportTaskResult 命令 ID。
  lastTaskReportRequestId?: ValueWithUpdatedAt<string>
  // 最近一次运行时错误。
  lastError?: ValueWithUpdatedAt<IAppError | null>
}
