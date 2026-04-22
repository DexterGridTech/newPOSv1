import {createKernelRuntimeApp} from '@impos2/kernel-base-runtime-shell-v2'
import {createTopologyRuntimeModuleV3} from '@impos2/kernel-base-topology-runtime-v3'
import {createUiRuntimeModuleV2} from '@impos2/kernel-base-ui-runtime-v2'
import type {PlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createModule as createRuntimeReactModule} from '@impos2/ui-base-runtime-react'
import {createModule} from '../../src'
import type {CreateTopologyRuntimeBridgeModuleInput} from '../../src'
import {createBrowserConsoleLogger} from '../../../runtime-react/test/support/browserConsoleLogger'

export const createTopologyRuntimeBridgeHarness = async (
    input: CreateTopologyRuntimeBridgeModuleInput = {},
) => {
    const app = createKernelRuntimeApp({
        runtimeName: 'ui-base-topology-runtime-bridge-test',
        modules: [
            createTopologyRuntimeModuleV3(),
            createUiRuntimeModuleV2(),
            createRuntimeReactModule(),
            createModule(input),
        ],
        platformPorts: {
            environmentMode: 'TEST',
            logger: createBrowserConsoleLogger({
                environmentMode: 'TEST',
                scope: {
                    moduleName: 'ui.base.topology-runtime-bridge.test-harness',
                    layer: 'ui',
                    subsystem: 'runtime',
                    component: 'TopologyRuntimeBridgeHarness',
                },
            }),
        } as Partial<PlatformPorts>,
        displayContext: {
            displayIndex: 0,
            displayCount: 1,
        },
    })
    const runtime = await app.start()
    return {
        app,
        runtime,
        store: runtime.getStore(),
    }
}

export {renderWithAutomation} from '../../../runtime-react/test/support/runtimeReactHarness'
export {UiRuntimeRootShell} from '@impos2/ui-base-runtime-react'
