import { selectTcpSandboxId, selectTcpTerminalId } from '@next/kernel-base-tcp-control-runtime-v2'
import {
  selectTopologyRuntimeV3Context,
  selectTopologyRuntimeV3DisplayMode,
} from '@next/kernel-base-topology-runtime-v3'
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
  const topologyContext = selectTopologyRuntimeV3Context(state as any)
  const topologyDisplayMode = selectTopologyRuntimeV3DisplayMode(state as any)
  if (!terminalId || !sandboxId) {
    return null
  }

  const resolvedDisplayIndex = topologyContext?.displayIndex ?? input.displayIndex ?? 0
  const topologyHasPairedDisplayRole = Boolean(
    topologyContext
    && (topologyContext.displayCount > 1 || topologyContext.enableSlave === true),
  )
  const resolvedDisplayRole = topologyDisplayMode === 'SECONDARY'
    ? 'secondary'
    : (
      topologyDisplayMode === 'PRIMARY' && topologyHasPairedDisplayRole
        ? 'primary'
        : (input.displayRole ?? 'single')
    )

  return {
    terminalId,
    sandboxId,
    payload: {
      displayIndex: resolvedDisplayIndex,
      displayRole: resolvedDisplayRole,
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
