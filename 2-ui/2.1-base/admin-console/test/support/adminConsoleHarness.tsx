import {
    createRuntimeReactHarness,
    renderWithAutomation,
    renderWithStore,
    type RuntimeReactHarness,
} from '../../../runtime-react/test/support/runtimeReactHarness'
import React from 'react'
import type {RenderWithAutomationResult} from '../../../runtime-react/test/support/renderWithAutomation'
import {
    InputRuntimeProvider,
    VirtualKeyboardOverlay,
} from '../../../input-runtime/src'
import type {PlatformPorts} from '@next/kernel-base-platform-ports'
import type {KernelRuntimeModuleV2} from '@next/kernel-base-runtime-shell-v2'
import type {CreateTopologyRuntimeModuleV3Input} from '@next/kernel-base-topology-runtime-v3'
import {createMemoryStorage} from '../../../../../1-kernel/test-support/storageHarness'
import type {CreateAdminConsoleModuleInput} from '../../src'
import {createModule} from '../../src'
import {resetAdminHostTools} from '../../src/supports/adminHostToolsRegistry'
import {resetAdminConsoleSections} from '../../src/supports/adminSectionRegistry'
import {resetAdminAdapterDiagnosticsScenarios} from '../../src/supports/adapterDiagnosticsRuntime'

export interface AdminConsoleHarness extends RuntimeReactHarness {}

export const createAdminConsoleHarness = async (
    input: CreateAdminConsoleModuleInput & {
        platformPorts?: Partial<PlatformPorts>
        modules?: readonly KernelRuntimeModuleV2[]
        topology?: CreateTopologyRuntimeModuleV3Input
        displayContext?: {
            displayIndex?: number
            displayCount?: number
        }
        resetGlobalRegistries?: boolean
    } = {},
): Promise<AdminConsoleHarness> => {
    const {
        displayContext,
        modules,
        platformPorts,
        resetGlobalRegistries = true,
        topology,
        ...moduleInput
    } = input

    if (resetGlobalRegistries) {
        resetAdminHostTools()
        resetAdminConsoleSections()
        resetAdminAdapterDiagnosticsScenarios()
    }

    return createRuntimeReactHarness({
        modules: [
            ...(modules ?? []),
            createModule(moduleInput),
        ],
        platformPorts: {
            stateStorage: createMemoryStorage().storage,
            secureStateStorage: createMemoryStorage().storage,
            ...platformPorts,
        },
        topology,
        displayContext,
    })
}

export const renderAdminWithAutomation = (
    element: React.ReactElement,
    harness: AdminConsoleHarness,
): RenderWithAutomationResult =>
    renderWithAutomation(
        <InputRuntimeProvider>
            {element}
            <VirtualKeyboardOverlay />
        </InputRuntimeProvider>,
        harness.store,
        harness.runtime,
    )

export {renderWithAutomation, renderWithStore}
