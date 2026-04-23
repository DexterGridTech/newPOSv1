import {
    createModuleActorFactory,
    onCommand,
    runtimeShellV2CommandDefinitions,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {bootstrapAssemblyRuntime} from '../../application/bootstrapRuntime'
import {moduleName} from '../../moduleName'
import type {AppProps} from '../../types'

const defineActor = createModuleActorFactory(moduleName)

export const createAssemblyRuntimeInitializeActor = (
    props: AppProps,
): ActorDefinition => defineActor('AssemblyRuntimeInitializeActor', [
    onCommand(runtimeShellV2CommandDefinitions.initialize, async context => {
        await bootstrapAssemblyRuntime(
            {
                dispatchCommand: context.dispatchCommand,
            } as any,
            props,
        )
        return {
            displayIndex: props.displayIndex,
            displayCount: props.displayCount,
            topologyRole: props.topology?.role,
        }
    }),
])
