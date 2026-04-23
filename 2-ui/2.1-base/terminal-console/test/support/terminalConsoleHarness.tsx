import {
    createRuntimeReactHarness,
    renderWithAutomation,
    renderWithStore,
    type RuntimeReactHarness,
} from '../../../runtime-react/test/support/runtimeReactHarness'
import {createTcpControlRuntimeModuleV2} from '../../../../../1-kernel/1.1-base/tcp-control-runtime-v2/src'
import {createMemoryStorage} from '../../../../../1-kernel/test-support/storageHarness'
import {createModule as createInputRuntimeModule} from '../../../input-runtime/src'
import {createModule} from '../../src'

export interface TerminalConsoleHarness extends RuntimeReactHarness {}

export const createTerminalConsoleHarness = async (
    input: Parameters<typeof createRuntimeReactHarness>[0] = {},
): Promise<TerminalConsoleHarness> =>
    createRuntimeReactHarness({
        ...input,
        modules: [
            createTcpControlRuntimeModuleV2(),
            createInputRuntimeModule(),
            createModule(),
            ...(input.modules ?? []),
        ],
        platformPorts: {
            stateStorage: createMemoryStorage().storage,
            secureStateStorage: createMemoryStorage().storage,
            ...input.platformPorts,
        },
    })

export {renderWithAutomation, renderWithStore}
