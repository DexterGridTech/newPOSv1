import {defineCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import type {
    DispatchPeerCommandInput,
    SetTopologyDisplayModeInput,
    SetTopologyEnableSlaveInput,
    SetTopologyInstanceModeInput,
    SetTopologyMasterInfoInput,
} from '../../types'

export const topologyRuntimeV2CommandDefinitions = {
    setInstanceMode: defineCommand<SetTopologyInstanceModeInput>({
        moduleName,
        commandName: 'set-instance-mode',
    }),
    setDisplayMode: defineCommand<SetTopologyDisplayModeInput>({
        moduleName,
        commandName: 'set-display-mode',
    }),
    setEnableSlave: defineCommand<SetTopologyEnableSlaveInput>({
        moduleName,
        commandName: 'set-enable-slave',
    }),
    setMasterInfo: defineCommand<SetTopologyMasterInfoInput>({
        moduleName,
        commandName: 'set-master-info',
    }),
    clearMasterInfo: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'clear-master-info',
    }),
    refreshTopologyContext: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'refresh-topology-context',
    }),
    startTopologyConnection: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'start-topology-connection',
    }),
    stopTopologyConnection: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'stop-topology-connection',
    }),
    restartTopologyConnection: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'restart-topology-connection',
    }),
    resumeTopologySession: defineCommand<Record<string, never>>({
        moduleName,
        commandName: 'resume-topology-session',
    }),
    dispatchPeerCommand: defineCommand<DispatchPeerCommandInput>({
        moduleName,
        commandName: 'dispatch-peer-command',
    }),
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
