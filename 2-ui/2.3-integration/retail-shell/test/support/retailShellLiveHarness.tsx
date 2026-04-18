import {
    createRuntimeReactHarness,
    renderWithAutomation,
    renderWithStore,
    type RuntimeReactHarness,
} from '../../../../2.1-base/runtime-react/test/support/runtimeReactHarness'
import {createFileStoragePair} from '../../../../../1-kernel/test-support/storageHarness'
import {
    createLivePlatform,
    createFetchTransport,
    waitFor,
    fetchJson,
} from '../../../../../1-kernel/1.1-base/tcp-control-runtime-v2/test/helpers/liveHarness'
import {
    kernelBaseTestServerConfig,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '../../../../../1-kernel/server-config-v2/src'
import {resolveTransportServers} from '../../../../../1-kernel/test-support/serverConfig'
import {createHttpRuntime} from '../../../../../1-kernel/1.1-base/transport-runtime/src'
import {createTcpControlRuntimeModuleV2} from '../../../../../1-kernel/1.1-base/tcp-control-runtime-v2/src'
import {createModule as createTerminalConsoleModule} from '../../../../2.1-base/terminal-console/src'
import {createModule as createAdminConsoleModule} from '../../../../2.1-base/admin-console/src'
import {createModule as createInputRuntimeModule} from '../../../../2.1-base/input-runtime/src'
import {createModule as createRetailShellModule} from '../../src'

export interface RetailShellLiveHarness extends RuntimeReactHarness {
    platform: Awaited<ReturnType<typeof createLivePlatform>>
    storagePair: ReturnType<typeof createFileStoragePair>
    cleanup(): Promise<void>
}

export const createRetailShellLiveHarness = async (): Promise<RetailShellLiveHarness> => {
    const platform = await createLivePlatform()
    const storagePair = createFileStoragePair('retail-shell-live')

    const harness = await createRuntimeReactHarness({
        modules: [
            createTcpControlRuntimeModuleV2({
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'ui.integration.retail-shell.live-test',
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
            createAdminConsoleModule(),
            createTerminalConsoleModule(),
            createRetailShellModule(),
        ],
        platformPorts: {
            stateStorage: storagePair.stateStorage.storage,
            secureStateStorage: storagePair.secureStateStorage.storage,
            device: {
                async getDeviceId() {
                    return 'DEVICE-LIVE-001'
                },
                async getPlatform() {
                    return 'test'
                },
            },
        },
    })

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

export {renderWithStore, renderWithAutomation, waitFor, fetchJson}
