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
import {
    createTopologyRuntimeV2ActorDefinitions,
    type TopologyRuntimeV2OrchestratorRef,
} from '../features/actors'
import {topologyRuntimeV2StateActions} from '../features/slices'
import type {CreateTopologyRuntimeModuleV2Input} from '../types'
import {createTopologyContextState} from '../foundations/context'
import {createTopologyPeerOrchestratorV2} from '../foundations/orchestrator'
import {TOPOLOGY_V2_RECOVERY_STATE_KEY} from '../foundations/stateKeys'
import {topologyRuntimeV2ModuleManifest} from './moduleManifest'

export const topologyRuntimeV2PreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createTopologyRuntimeModuleV2 = (
    input: CreateTopologyRuntimeModuleV2Input = {},
): KernelRuntimeModuleV2 => {
    const orchestratorRef: TopologyRuntimeV2OrchestratorRef = {}

    return defineKernelRuntimeModuleV2({
        ...topologyRuntimeV2ModuleManifest,
        actorDefinitions: createTopologyRuntimeV2ActorDefinitions(orchestratorRef),
        preSetup: topologyRuntimeV2PreSetup,
        install(context: RuntimeModuleContextV2) {
            let lastContextFingerprint = ''
            const syncContextState = () => {
                const recoveryState = context.getState()?.[
                    TOPOLOGY_V2_RECOVERY_STATE_KEY as keyof ReturnType<typeof context.getState>
                ] as any
                const nextContext = createTopologyContextState({
                    localNodeId: context.localNodeId,
                    recoveryState: recoveryState ?? {},
                })
                const nextFingerprint = JSON.stringify(nextContext)
                if (nextFingerprint === lastContextFingerprint) {
                    return
                }
                lastContextFingerprint = nextFingerprint
                context.dispatchAction(topologyRuntimeV2StateActions.replaceContextState(nextContext))
            }

            syncContextState()
            context.subscribeState(syncContextState)

            if (input.assembly) {
                const orchestrator = createTopologyPeerOrchestratorV2({
                    context,
                    assembly: input.assembly,
                    reconnectAttemptsOverride: input.socket?.reconnectAttempts,
                })
                orchestratorRef.current = orchestrator
                context.installPeerDispatchGateway(orchestrator.gateway)
            }

            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: topologyRuntimeV2ModuleManifest.stateSliceNames,
                commandNames: topologyRuntimeV2ModuleManifest.commandNames,
                hasAssembly: Boolean(input.assembly),
            })
        },
    })
}

export const topologyRuntimeModuleV2Descriptor =
    deriveKernelRuntimeModuleDescriptorV2(createTopologyRuntimeModuleV2)
