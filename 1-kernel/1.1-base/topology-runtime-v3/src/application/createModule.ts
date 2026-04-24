import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    createCommand,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {deriveTopologyV3RuntimeContext} from '../foundations/runtimeDerivation'
import {TOPOLOGY_V3_CONFIG_STATE_KEY} from '../foundations/stateKeys'
import {createTopologyRuntimeV3ActorDefinitions} from '../features/actors'
import {topologyRuntimeV3StateActions} from '../features/slices'
import type {TopologyV3ConfigRuntimeState} from '../types/state'
import type {CreateTopologyRuntimeModuleV3Input, TopologyPeerOrchestratorV3} from '../types/runtime'
import {createTopologyPeerOrchestratorV3} from '../foundations/connectionController'
import {topologyRuntimeV3ModuleManifest} from './moduleManifest'
import {
    resolvePowerDisplaySwitchTarget,
} from '../foundations/powerDisplaySwitch'
import {topologyRuntimeV3CommandDefinitions} from '../features/commands'
import {
    selectTopologyRuntimeV3Connection,
    selectTopologyRuntimeV3Context,
} from '../selectors'

export const topologyRuntimeV3PreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createTopologyRuntimeModuleV3 = (
    input: CreateTopologyRuntimeModuleV3Input = {},
): KernelRuntimeModuleV2 => {
    const orchestratorRef: {current?: TopologyPeerOrchestratorV3} = {
        current: input.orchestrator,
    }

    return defineKernelRuntimeModuleV2({
        ...topologyRuntimeV3ModuleManifest,
        actorDefinitions: createTopologyRuntimeV3ActorDefinitions(orchestratorRef),
        preSetup: topologyRuntimeV3PreSetup,
        install(context: RuntimeModuleContextV2) {
            let lastFingerprint = ''
            let lastPowerConnected: boolean | null = null

            const syncContextState = () => {
                const configState = context.getState()?.[
                    TOPOLOGY_V3_CONFIG_STATE_KEY as keyof ReturnType<typeof context.getState>
                ] as TopologyV3ConfigRuntimeState | undefined

                const nextContext = deriveTopologyV3RuntimeContext({
                    displayIndex: context.displayContext.displayIndex,
                    displayCount: context.displayContext.displayCount,
                    configState: configState ?? {},
                })

                const fullState = {
                    ...nextContext,
                    localNodeId: context.localNodeId,
                }

                const nextFingerprint = JSON.stringify(fullState)
                if (nextFingerprint === lastFingerprint) {
                    return
                }
                lastFingerprint = nextFingerprint
                context.dispatchAction(topologyRuntimeV3StateActions.replaceContextState(fullState))
            }

            syncContextState()
            context.subscribeState(syncContextState)

            let hostLifecycleFingerprint = ''
            const scheduleHostLifecycleSync = () => {
                const topologyContext = selectTopologyRuntimeV3Context(context.getState())
                const connectionState = selectTopologyRuntimeV3Connection(context.getState())
                const nextFingerprint = JSON.stringify({
                    instanceMode: topologyContext?.instanceMode,
                    displayMode: topologyContext?.displayMode,
                    displayCount: topologyContext?.displayCount,
                    displayIndex: topologyContext?.displayIndex,
                    enableSlave: topologyContext?.enableSlave,
                    standalone: topologyContext?.standalone,
                    masterLocator: topologyContext?.masterLocator ?? null,
                    connectionStatus: connectionState?.serverConnectionStatus,
                })
                if (nextFingerprint === hostLifecycleFingerprint) {
                    return
                }
                hostLifecycleFingerprint = nextFingerprint
                void context.dispatchCommand(createCommand(
                    topologyRuntimeV3CommandDefinitions.syncTopologyHostLifecycle,
                    {},
                ))
            }

            scheduleHostLifecycleSync()
            context.subscribeState(scheduleHostLifecycleSync)

            const removePowerListener = context.platformPorts.device?.addPowerStatusChangeListener?.(event => {
                const powerConnected = Boolean(event?.powerConnected)
                if (lastPowerConnected === powerConnected) {
                    return
                }
                if (lastPowerConnected == null) {
                    lastPowerConnected = powerConnected
                    context.platformPorts.logger.info({
                        category: 'topology.runtime',
                        event: 'power-display-switch-seeded',
                        message: 'Seeded topology power state without changing display mode',
                        data: {
                            displayIndex: context.displayContext.displayIndex,
                            displayCount: context.displayContext.displayCount,
                            powerConnected,
                        },
                    })
                    return
                }
                lastPowerConnected = powerConnected
                const displayMode = resolvePowerDisplaySwitchTarget({
                    context: selectTopologyRuntimeV3Context(context.getState()),
                    powerConnected,
                })
                if (!displayMode) {
                    return
                }
                void context.dispatchCommand(createCommand(
                    topologyRuntimeV3CommandDefinitions.requestPowerDisplayModeSwitchConfirmation,
                    {
                        displayMode,
                        powerConnected,
                        reason: 'power-status-change',
                    },
                ))
            })

            if (!orchestratorRef.current && input.assembly) {
                orchestratorRef.current = createTopologyPeerOrchestratorV3({
                    context,
                    assembly: input.assembly,
                    reconnectAttemptsOverride: input.socket?.reconnectAttempts,
                    reconnectDelayMsOverride: input.socket?.reconnectDelayMs,
                })
            }

            if (orchestratorRef.current) {
                context.installPeerDispatchGateway({
                    dispatchCommand: (command, options) => {
                        if (!orchestratorRef.current?.dispatchRemoteCommand) {
                            throw new Error('Topology peer dispatch gateway is not available')
                        }
                        const routeContext = options.routeContext
                        return orchestratorRef.current.dispatchRemoteCommand({
                            requestId: options.requestId!,
                            commandId: options.commandId!,
                            parentCommandId: options.parentCommandId,
                            commandName: command.definition.commandName,
                            payload: command.payload,
                            routeContext: routeContext && typeof routeContext === 'object'
                                ? routeContext as Record<string, unknown>
                                : undefined,
                        })
                    },
                })
            }

            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: topologyRuntimeV3ModuleManifest.stateSliceNames,
                commandNames: topologyRuntimeV3ModuleManifest.commandNames,
                powerDisplaySwitchListener: Boolean(removePowerListener),
            })
        },
    })
}

export const topologyRuntimeModuleV3Descriptor =
    deriveKernelRuntimeModuleDescriptorV2(createTopologyRuntimeModuleV3)
