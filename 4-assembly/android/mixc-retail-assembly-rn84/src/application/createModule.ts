import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {AppProps} from '../types'
import {moduleName} from '../moduleName'
import {createAssemblyRuntimeInitializeActor} from '../features/actors'
import {assemblyRuntimeModuleManifest} from './moduleManifest'
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
    },
})
