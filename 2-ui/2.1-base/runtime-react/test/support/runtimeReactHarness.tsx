import React from 'react'
import TestRenderer from 'react-test-renderer'
import {Provider} from 'react-redux'
import type {
    KernelRuntimeAppV2,
    KernelRuntimeModuleV2,
    KernelRuntimeV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {createKernelRuntimeApp} from '@impos2/kernel-base-runtime-shell-v2'
import {createTopologyRuntimeModuleV2} from '@impos2/kernel-base-topology-runtime-v2'
import type {CreateTopologyRuntimeModuleV2Input} from '@impos2/kernel-base-topology-runtime-v2'
import {createUiRuntimeModuleV2} from '@impos2/kernel-base-ui-runtime-v2'
import type {PlatformPorts} from '@impos2/kernel-base-platform-ports'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {createModule, UiRuntimeProvider} from '../../src'
import {createBrowserConsoleLogger} from './browserConsoleLogger'

export interface RuntimeReactHarness {
    app: KernelRuntimeAppV2
    runtime: KernelRuntimeV2
    store: EnhancedStore
}

export const createRuntimeReactHarness = async (
    input: {
        modules?: readonly KernelRuntimeModuleV2[]
        platformPorts?: Partial<PlatformPorts>
        displayContext?: {
            displayIndex?: number
            displayCount?: number
        }
        topology?: CreateTopologyRuntimeModuleV2Input
        localNodeId?: string
    } = {},
): Promise<RuntimeReactHarness> => {
    const app = createKernelRuntimeApp({
        runtimeName: 'ui-base-runtime-react-test',
        localNodeId: input.localNodeId as any,
        modules: [
            createTopologyRuntimeModuleV2(input.topology),
            createUiRuntimeModuleV2(),
            createModule(),
            ...(input.modules ?? []),
        ],
        platformPorts: {
            environmentMode: 'TEST',
            logger: createBrowserConsoleLogger({
                environmentMode: input.platformPorts?.environmentMode ?? 'TEST',
                scope: {
                    moduleName: 'ui.base.runtime-react.test-harness',
                    layer: 'ui',
                    subsystem: 'runtime',
                    component: 'RuntimeReactHarness',
                },
            }),
            ...input.platformPorts,
        },
        displayContext: input.displayContext,
    })
    const runtime = await app.start()

    return {
        app,
        runtime,
        store: runtime.getStore(),
    }
}

export const renderWithStore = (
    element: React.ReactElement,
    store: EnhancedStore,
    runtime?: KernelRuntimeV2,
): TestRenderer.ReactTestRenderer =>
    TestRenderer.create(
        <Provider store={store}>
            <UiRuntimeProvider runtime={runtime ?? ((store as any).runtime as KernelRuntimeV2)}>
                {element}
            </UiRuntimeProvider>
        </Provider>,
    )
