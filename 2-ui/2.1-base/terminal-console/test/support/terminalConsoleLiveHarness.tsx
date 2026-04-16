import React from 'react'
import TestRenderer from 'react-test-renderer'
import {Provider} from 'react-redux'
import type {EnhancedStore} from '@reduxjs/toolkit'
import type {PlatformPorts} from '@impos2/kernel-base-platform-ports'
import type {KernelRuntimeModuleV2, KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createLivePlatform,
    createFetchTransport,
    fetchJson,
    waitFor,
} from '../../../../../1-kernel/1.1-base/tcp-control-runtime-v2/test/helpers/liveHarness'
import {
    kernelBaseTestServerConfig,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '../../../../../1-kernel/server-config-v2/src'
import {resolveTransportServers} from '../../../../../1-kernel/test-support/serverConfig'
import {createHttpRuntime} from '../../../../../1-kernel/1.1-base/transport-runtime/src'
import {createTcpControlRuntimeModuleV2} from '../../../../../1-kernel/1.1-base/tcp-control-runtime-v2/src'
import {createFileStoragePair} from '../../../../../1-kernel/test-support/storageHarness'
import {
    createRuntimeReactHarness,
    type RuntimeReactHarness,
} from '../../../runtime-react/test/support/runtimeReactHarness'
import {UiRuntimeProvider} from '../../../runtime-react/src'
import {createModule as createInputRuntimeModule} from '../../../input-runtime/src'
import {createModule as createTerminalConsoleModule} from '../../src'

export interface TerminalConsoleLiveHarness extends RuntimeReactHarness {
    platform: Awaited<ReturnType<typeof createLivePlatform>>
    storagePair: ReturnType<typeof createFileStoragePair>
    cleanup(): Promise<void>
}

export const createTerminalConsoleLiveHarness = async (
    input: {
        modules?: readonly KernelRuntimeModuleV2[]
        platformPorts?: Partial<PlatformPorts>
    } = {},
): Promise<TerminalConsoleLiveHarness> => {
    const platform = await createLivePlatform()
    const storagePair = createFileStoragePair('terminal-console-live')

    const harness = await createRuntimeReactHarness({
        modules: [
            createTcpControlRuntimeModuleV2({
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'ui.base.terminal-console.live-test',
                                subsystem: 'transport.http',
                            }),
                            transport: createFetchTransport(),
                            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                                baseUrlOverrides: {
                                    [SERVER_NAME_MOCK_TERMINAL_PLATFORM]: platform.baseUrl,
                                },
                            }),
                        })
                    },
                },
            }),
            createInputRuntimeModule(),
            createTerminalConsoleModule(),
            ...(input.modules ?? []),
        ],
        platformPorts: {
            environmentMode: 'DEV',
            stateStorage: storagePair.stateStorage.storage,
            secureStateStorage: storagePair.secureStateStorage.storage,
            device: {
                async getDeviceId() {
                    return 'TERMINAL-CONSOLE-LIVE-DEVICE-001'
                },
                async getPlatform() {
                    return 'test'
                },
            },
            ...input.platformPorts,
        },
    })

    await harness.runtime.dispatchCommand(createCommand(
        runtimeShellV2CommandDefinitions.initialize,
        {},
    ))

    return {
        ...harness,
        platform,
        storagePair,
        async cleanup() {
            storagePair.cleanup()
            await platform.close()
        },
    }
}

export const renderTerminalConsoleLive = (
    element: React.ReactElement,
    store: EnhancedStore,
    runtime: KernelRuntimeV2,
) =>
    TestRenderer.create(
        <Provider store={store}>
            <UiRuntimeProvider runtime={runtime}>
                {element}
            </UiRuntimeProvider>
        </Provider>,
    )

export {fetchJson, waitFor}
