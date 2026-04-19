import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {deriveTopologyV3RuntimeContext} from '../foundations/runtimeDerivation'
import {TOPOLOGY_V3_CONFIG_STATE_KEY} from '../foundations/stateKeys'
import {createTopologyRuntimeV3ActorDefinitions} from '../features/actors'
import {topologyRuntimeV3StateActions} from '../features/slices'
import type {TopologyV3ConfigRuntimeState} from '../types/state'
import type {CreateTopologyRuntimeModuleV3Input, TopologyPeerOrchestratorV3} from '../types/runtime'
import {createTopologyPeerOrchestratorV3} from '../foundations/connectionController'
import {topologyRuntimeV3ModuleManifest} from './moduleManifest'

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

            if (!orchestratorRef.current && input.assembly) {
                orchestratorRef.current = createTopologyPeerOrchestratorV3({
                    context,
                    assembly: input.assembly,
                    reconnectAttemptsOverride: input.socket?.reconnectAttempts,
                    reconnectDelayMsOverride: input.socket?.reconnectDelayMs,
                })
            }

            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: topologyRuntimeV3ModuleManifest.stateSliceNames,
                commandNames: topologyRuntimeV3ModuleManifest.commandNames,
            })
        },
    })
}

export const topologyRuntimeModuleV3Descriptor =
    deriveKernelRuntimeModuleDescriptorV2(createTopologyRuntimeModuleV3)
