import {
    createRuntimeReactHarness,
    renderWithAutomation,
    renderWithStore,
    type RuntimeReactHarness,
} from '../../../../2.1-base/runtime-react/test/support/runtimeReactHarness'
import {createMemoryStorage} from '../../../../../1-kernel/test-support/storageHarness'
import {createTcpControlRuntimeModuleV2} from '../../../../../1-kernel/1.1-base/tcp-control-runtime-v2/src'
import {createTdpSyncRuntimeModuleV2} from '../../../../../1-kernel/1.1-base/tdp-sync-runtime-v2/src'
import {
    createHttpRuntime,
    type HttpTransport,
} from '../../../../../1-kernel/1.1-base/transport-runtime/src'
import type {DeactivateTerminalApiResponse} from '../../../../../1-kernel/1.1-base/tcp-control-runtime-v2/src'
import {kernelBaseTestServerConfig} from '../../../../../1-kernel/server-config-v2/src'
import {resolveTransportServers} from '../../../../../1-kernel/test-support/serverConfig'
import {createModule as createTerminalConsoleModule} from '../../../../2.1-base/terminal-console/src'
import {createModule as createAdminConsoleModule} from '../../../../2.1-base/admin-console/src'
import {createModule as createInputRuntimeModule} from '../../../../2.1-base/input-runtime/src'
import {createOrganizationIamMasterDataModule} from '../../../../../1-kernel/1.2-business/organization-iam-master-data/src'
import {createCateringProductMasterDataModule} from '../../../../../1-kernel/1.2-business/catering-product-master-data/src'
import {createCateringStoreOperatingMasterDataModule} from '../../../../../1-kernel/1.2-business/catering-store-operating-master-data/src'
import {createModule as createCateringMasterDataWorkbenchModule} from '../../../../2.2-business/catering-master-data-workbench/src'
import {createModule} from '../../src'

export interface RetailShellHarness extends RuntimeReactHarness {}

const createRetailShellMockTransport = (): HttpTransport => ({
    async execute(request) {
        if (request.endpoint.pathTemplate === '/api/v1/terminals/{terminalId}/deactivate') {
            const terminalId = (request.input.path as {terminalId?: string} | undefined)?.terminalId ?? 'terminal-test'
            const response: DeactivateTerminalApiResponse = {
                terminalId,
                status: 'DEACTIVATED',
            }
            return {
                data: {
                    success: true,
                    data: response,
                } as any,
                status: 200,
                statusText: 'OK',
                headers: {},
            }
        }
        throw new Error(`unexpected tcp http endpoint: ${request.endpoint.name}`)
    },
})

export const createRetailShellHarness = async (
    input: {
        displayContext?: {
            displayIndex?: number
            displayCount?: number
        }
    } = {},
): Promise<RetailShellHarness> =>
    createRuntimeReactHarness({
        modules: [
            createTcpControlRuntimeModuleV2({
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'ui.integration.retail-shell.test',
                                subsystem: 'transport.http',
                            }),
                            transport: createRetailShellMockTransport(),
                            servers: resolveTransportServers(kernelBaseTestServerConfig),
                        })
                    },
                },
            }),
            createTdpSyncRuntimeModuleV2(),
            createInputRuntimeModule(),
            createAdminConsoleModule(),
            createTerminalConsoleModule(),
            createOrganizationIamMasterDataModule(),
            createCateringProductMasterDataModule(),
            createCateringStoreOperatingMasterDataModule(),
            createCateringMasterDataWorkbenchModule(),
            createModule(),
        ],
        platformPorts: {
            stateStorage: createMemoryStorage().storage,
            secureStateStorage: createMemoryStorage().storage,
            device: {
                async getDeviceId() {
                    return 'DEVICE-001'
                },
                async getPlatform() {
                    return 'test'
                },
            },
        },
        displayContext: {
            displayIndex: input.displayContext?.displayIndex ?? 0,
            displayCount: input.displayContext?.displayCount ?? 1,
        },
    })

export {renderWithStore, renderWithAutomation}
