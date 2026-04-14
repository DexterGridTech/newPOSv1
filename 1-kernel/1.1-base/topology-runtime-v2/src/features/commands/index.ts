import {createModuleCommandFactory} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {
    DispatchPeerCommandInput,
    SetTopologyDisplayModeInput,
    SetTopologyEnableSlaveInput,
    SetTopologyInstanceModeInput,
    SetTopologyMasterInfoInput,
} from '../../types'

const defineModuleCommand = createModuleCommandFactory(moduleName)

export const topologyRuntimeV2CommandDefinitions = {
    setInstanceMode: defineModuleCommand<SetTopologyInstanceModeInput>('set-instance-mode'),
    setDisplayMode: defineModuleCommand<SetTopologyDisplayModeInput>('set-display-mode'),
    setEnableSlave: defineModuleCommand<SetTopologyEnableSlaveInput>('set-enable-slave'),
    setMasterInfo: defineModuleCommand<SetTopologyMasterInfoInput>('set-master-info'),
    clearMasterInfo: defineModuleCommand<Record<string, never>>('clear-master-info'),
    refreshTopologyContext: defineModuleCommand<Record<string, never>>('refresh-topology-context'),
    startTopologyConnection: defineModuleCommand<Record<string, never>>('start-topology-connection'),
    stopTopologyConnection: defineModuleCommand<Record<string, never>>('stop-topology-connection'),
    restartTopologyConnection: defineModuleCommand<Record<string, never>>('restart-topology-connection'),
    resumeTopologySession: defineModuleCommand<Record<string, never>>('resume-topology-session'),
    dispatchPeerCommand: defineModuleCommand<DispatchPeerCommandInput>('dispatch-peer-command'),
} as const

export const topologyRuntimeV2CommandNames = Object.fromEntries(
    Object.entries(topologyRuntimeV2CommandDefinitions).map(([key, definition]) => [
        key,
        definition.commandName,
    ]),
) as {
    readonly [K in keyof typeof topologyRuntimeV2CommandDefinitions]: typeof topologyRuntimeV2CommandDefinitions[K]['commandName']
}

export const topologyCommandDefinitions = topologyRuntimeV2CommandDefinitions
export const topologyCommandNames = topologyRuntimeV2CommandNames
