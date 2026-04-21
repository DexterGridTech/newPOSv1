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
import type {PlatformPorts} from '@impos2/kernel-base-platform-ports'
import type {KernelRuntimeModuleV2} from '@impos2/kernel-base-runtime-shell-v2'
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
        topology?: Parameters<typeof createRuntimeReactHarness>[0]['topology']
        displayContext?: {
            displayIndex?: number
            displayCount?: number
        }
    } = {},
): Promise<AdminConsoleHarness> => {
    const {
        displayContext,
        modules,
        platformPorts,
        topology,
        ...moduleInput
    } = input

    resetAdminHostTools()
    resetAdminConsoleSections()
    resetAdminAdapterDiagnosticsScenarios()

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
