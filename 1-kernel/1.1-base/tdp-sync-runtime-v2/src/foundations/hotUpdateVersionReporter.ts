import { selectTcpSandboxId, selectTcpTerminalId } from '@impos2/kernel-base-tcp-control-runtime-v2'
import { selectTdpHotUpdateState } from '../selectors'

export const buildHotUpdateVersionReportPayload = (state: unknown, input: {
  appId: string
  assemblyVersion: string
  buildNumber: number
  runtimeVersion: string
  displayIndex?: number
  displayRole?: 'primary' | 'secondary' | 'single'
  state: 'BOOTING' | 'RUNNING' | 'FAILED' | 'ROLLED_BACK'
  reason?: string
}) => {
  const terminalId = selectTcpTerminalId(state as any)
  const sandboxId = selectTcpSandboxId(state as any)
  const hotUpdate = selectTdpHotUpdateState(state as any)
  if (!terminalId || !sandboxId) {
    return null
  }
  return {
    terminalId,
    sandboxId,
    payload: {
      displayIndex: input.displayIndex ?? 0,
      displayRole: input.displayRole ?? 'single',
      appId: input.appId,
      assemblyVersion: input.assemblyVersion,
      buildNumber: input.buildNumber,
      runtimeVersion: input.runtimeVersion,
      bundleVersion: hotUpdate?.current.bundleVersion ?? 'unknown',
      source: hotUpdate?.current.source ?? 'embedded',
      packageId: hotUpdate?.current.packageId,
      releaseId: hotUpdate?.current.releaseId,
      state: input.state,
      reason: input.reason,
    },
  }
}
