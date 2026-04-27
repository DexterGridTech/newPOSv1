import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createCommand,
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {registerUiRendererParts} from '@next/ui-base-runtime-react'
import {createAdminTopologyActor} from '../features/actors'
import {moduleName} from '../moduleName'
import {
    adminConsoleScreenDefinitions,
    adminConsoleScreenParts,
} from '../foundations/adminScreenParts'
import {createAdminHostTools} from '../supports/adminHostToolsFactory'
import {installAdminHostTools} from '../supports/adminHostToolsRegistry'
import {installAdminAdapterDiagnosticsScenarios} from '../supports/adapterDiagnosticsRuntime'
import {installAdminConsoleSections} from '../supports/adminSectionRegistry'
import {adminConsoleModuleManifest} from './moduleManifest'
import type {CreateAdminHostToolsInput} from '../supports/adminHostToolsFactory'
import type {AdminHostTools} from '../types'

export interface CreateAdminConsoleModuleInput {
    adapterDiagnosticScenarios?: Parameters<typeof installAdminAdapterDiagnosticsScenarios>[0]
    hostToolSources?: Omit<CreateAdminHostToolsInput, 'platformPorts'>
    hostTools?: Partial<AdminHostTools>
    sections?: Parameters<typeof installAdminConsoleSections>[0]
}

export const adminConsolePreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    registerUiRendererParts(Object.values(adminConsoleScreenParts))
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createModule = (
    input: CreateAdminConsoleModuleInput = {},
): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...adminConsoleModuleManifest,
        actorDefinitions: [createAdminTopologyActor()],
        preSetup: adminConsolePreSetup,
        async install(context: RuntimeModuleContextV2) {
            if (input.adapterDiagnosticScenarios) {
                installAdminAdapterDiagnosticsScenarios(input.adapterDiagnosticScenarios)
            }
            installAdminHostTools(
                context.localNodeId,
                {
                    ...createAdminHostTools({
                        platformPorts: context.platformPorts,
                        ...(input.hostToolSources ?? {}),
                    }),
                    ...(input.hostTools ?? {}),
                },
            )
            if (input.sections) {
                installAdminConsoleSections(input.sections)
            }
            await context.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.registerScreenDefinitions, {
                definitions: adminConsoleScreenDefinitions,
            }))
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall()
        },
    })
