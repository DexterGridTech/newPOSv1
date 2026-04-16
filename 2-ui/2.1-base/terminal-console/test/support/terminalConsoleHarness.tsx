import {
    createRuntimeReactHarness,
    renderWithStore,
    type RuntimeReactHarness,
} from '../../../runtime-react/test/support/runtimeReactHarness'
import {createTcpControlRuntimeModuleV2} from '../../../../../1-kernel/1.1-base/tcp-control-runtime-v2/src'
import {createMemoryStorage} from '../../../../../1-kernel/test-support/storageHarness'
import {createModule as createInputRuntimeModule} from '../../../input-runtime/src'
import {createModule} from '../../src'

export interface TerminalConsoleHarness extends RuntimeReactHarness {}

export const createTerminalConsoleHarness = async (): Promise<TerminalConsoleHarness> =>
    createRuntimeReactHarness({
        modules: [
            createTcpControlRuntimeModuleV2(),
            createInputRuntimeModule(),
            createModule(),
        ],
        platformPorts: {
            stateStorage: createMemoryStorage().storage,
            secureStateStorage: createMemoryStorage().storage,
        },
    })

export {renderWithStore}
