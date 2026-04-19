import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
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
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createModule = (
    input: CreateAdminConsoleModuleInput = {},
): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...adminConsoleModuleManifest,
        preSetup: adminConsolePreSetup,
        install(context: RuntimeModuleContextV2) {
            if (input.adapterDiagnosticScenarios) {
                installAdminAdapterDiagnosticsScenarios(input.adapterDiagnosticScenarios)
            }
            installAdminHostTools({
                ...createAdminHostTools({
                    platformPorts: context.platformPorts,
                    ...(input.hostToolSources ?? {}),
                }),
                ...(input.hostTools ?? {}),
            })
            if (input.sections) {
                installAdminConsoleSections(input.sections)
            }
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall()
        },
    })
