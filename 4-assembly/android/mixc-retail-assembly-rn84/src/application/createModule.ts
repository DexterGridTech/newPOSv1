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

        removePowerListener(event => {
            void handleAssemblyPowerDisplaySwitch({
                context: selectTopologyRuntimeV3Context(context.getState()),
                powerConnected: Boolean(event?.powerConnected),
                dispatchCommand: context.dispatchCommand,
            })
        })
    },
})
