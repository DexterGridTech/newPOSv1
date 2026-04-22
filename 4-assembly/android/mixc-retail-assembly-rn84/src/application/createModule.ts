import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {selectTopologyRuntimeV3Context} from '@impos2/kernel-base-topology-runtime-v3'
import type {AppProps} from '../types'
import {moduleName} from '../moduleName'
import {createAssemblyRuntimeInitializeActor} from '../features/actors'
import {assemblyRuntimeModuleManifest} from './moduleManifest'
import {nativeDevice} from '../turbomodules/device'
import {handleAssemblyPowerDisplaySwitch} from './topology'
import {syncHotUpdateStateFromNativeBoot} from './syncHotUpdateStateFromNativeBoot'

export const assemblyRuntimePreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createModule = (
    props: AppProps,
): KernelRuntimeModuleV2 => defineKernelRuntimeModuleV2({
    ...assemblyRuntimeModuleManifest,
    actorDefinitions: [createAssemblyRuntimeInitializeActor(props)],
    preSetup: assemblyRuntimePreSetup,
    async onApplicationReset(context, input) {
        await syncHotUpdateStateFromNativeBoot(context, {
            initializeEmbeddedCurrent: false,
            previousState: input?.previousState,
        })
    },
    install(context: RuntimeModuleContextV2) {
        createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
            displayIndex: props.displayIndex,
            displayCount: props.displayCount,
            topologyRole: props.topology?.role,
        })

        const removePowerListener = context.platformPorts.device?.addPowerStatusChangeListener
            ?? nativeDevice.addPowerStatusChangeListener
        if (!removePowerListener) {
            return
        }

        let lastPowerConnected: boolean | null = null

        removePowerListener(event => {
            const powerConnected = Boolean(event?.powerConnected)
            if (lastPowerConnected === powerConnected) {
                return
            }
            if (lastPowerConnected == null) {
                lastPowerConnected = powerConnected
                context.platformPorts.logger.info({
                    category: 'assembly.topology',
                    event: 'power-display-switch-seeded',
                    message: 'Seeded standalone slave power state without changing display mode',
                    data: {
                        displayIndex: props.displayIndex,
                        displayCount: props.displayCount,
                        powerConnected,
                    },
                })
                return
            }
            lastPowerConnected = powerConnected
            void handleAssemblyPowerDisplaySwitch({
                context: selectTopologyRuntimeV3Context(context.getState()),
                powerConnected,
                dispatchCommand: context.dispatchCommand,
            })
        })
    },
})
